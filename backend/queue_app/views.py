import json
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from py_vapid import Vapid
from pywebpush import webpush, WebPushException

from .models import Customer, QueueSettings
from .serializers import (
    CustomerSerializer, RegisterSerializer,
    QueueStatusSerializer, QueueSettingsSerializer,
)


def _get_settings() -> QueueSettings:
    obj, _ = QueueSettings.objects.get_or_create(pk=1)
    return obj


def _send_push(subscription: dict, number: int) -> None:
    if not subscription or not settings.VAPID_PRIVATE_KEY:
        return
    try:
        vapid = Vapid.from_string(settings.VAPID_PRIVATE_KEY)
        webpush(
            subscription_info=subscription,
            data=json.dumps({'number': number}),
            vapid_private_key=vapid,
            vapid_claims={'sub': f'mailto:{settings.VAPID_CLAIM_EMAIL}'},
        )
    except WebPushException:
        pass


# ── 고객: 대기 상태 확인 ──
@api_view(['GET'])
def queue_status(request):
    qs = _get_settings()
    waiting_count = Customer.objects.filter(status=Customer.STATUS_WAITING).count()
    called_count  = Customer.objects.filter(status=Customer.STATUS_CALLED).count()
    data = {
        'waiting_count': waiting_count,
        'called_count':  called_count,
        'max_count':     qs.max_count,
        'is_full':       waiting_count >= qs.max_count,
    }
    return Response(QueueStatusSerializer(data).data)


# ── 고객: 등록 ──
@api_view(['POST'])
def register(request):
    ser = RegisterSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    qs = _get_settings()
    waiting_count = Customer.objects.filter(status=Customer.STATUS_WAITING).count()
    if waiting_count >= qs.max_count:
        return Response({'detail': 'full'}, status=status.HTTP_409_CONFLICT)

    last = Customer.objects.order_by('-number').first()
    number = (last.number + 1) if last else 1

    customer = Customer.objects.create(
        number=number,
        name=ser.validated_data['name'],
        phone=ser.validated_data['phone'],
        push_subscription=ser.validated_data.get('push_subscription'),
    )
    return Response(CustomerSerializer(customer).data, status=status.HTTP_201_CREATED)


# ── 고객: 내 정보·순번 조회 ──
@api_view(['GET'])
def customer_detail(request, number):
    try:
        customer = Customer.objects.get(number=number)
    except Customer.DoesNotExist:
        return Response({'detail': 'not found'}, status=status.HTTP_404_NOT_FOUND)
    return Response(CustomerSerializer(customer).data)


# ── 관리자: 전체 목록 ──
@api_view(['GET'])
def admin_customers(request):
    customers = Customer.objects.all()
    return Response(CustomerSerializer(customers, many=True).data)


# ── 관리자: 호출 ──
@api_view(['POST'])
def admin_call(request):
    waiting = Customer.objects.filter(status=Customer.STATUS_WAITING).order_by('number')
    batch = list(waiting[:5])
    if not batch:
        return Response({'detail': 'no waiting customers'}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()
    for customer in batch:
        customer.status    = Customer.STATUS_CALLED
        customer.called_at = now
        customer.save()
        _send_push(customer.push_subscription, customer.number)

    return Response(CustomerSerializer(batch, many=True).data)


# ── 관리자: 설정 조회·변경 ──
@api_view(['GET', 'PUT'])
def admin_settings(request):
    qs = _get_settings()
    if request.method == 'GET':
        return Response(QueueSettingsSerializer(qs).data)

    ser = QueueSettingsSerializer(qs, data=request.data, partial=True)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    ser.save()
    return Response(ser.data)


# ── 고객: Push Subscription 저장 ──
@api_view(['POST'])
def save_subscription(request, number):
    try:
        customer = Customer.objects.get(number=number)
    except Customer.DoesNotExist:
        return Response({'detail': 'not found'}, status=status.HTTP_404_NOT_FOUND)
    customer.push_subscription = request.data.get('subscription')
    customer.save()
    return Response({'detail': 'ok'})


# ── 관리자: 초기화 ──
@api_view(['POST'])
def admin_reset(request):
    Customer.objects.all().delete()
    return Response({'detail': 'reset complete'})
