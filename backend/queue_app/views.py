import hashlib
import hmac
import secrets
import time
import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Customer, QueueSettings
from .serializers import (
    CustomerSerializer, RegisterSerializer,
    QueueStatusSerializer, QueueSettingsSerializer,
)


def _get_settings() -> QueueSettings:
    obj, _ = QueueSettings.objects.get_or_create(pk=1)
    return obj


def _send_sms(phone: str, number: int) -> None:
    if getattr(settings, 'LOAD_TEST_MODE', False):
        return
    api_key = settings.SOLAPI_API_KEY
    api_secret = settings.SOLAPI_API_SECRET
    sender = settings.SOLAPI_SENDER
    if not api_key or not api_secret or not sender:
        return
    try:
        date = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        salt = secrets.token_hex(16)
        signature = hmac.new(
            api_secret.encode(), f'{date}{salt}'.encode(), hashlib.sha256
        ).hexdigest()
        headers = {
            'Authorization': f'HMAC-SHA256 apiKey={api_key}, date={date}, salt={salt}, signature={signature}',
            'Content-Type': 'application/json',
        }
        body = {
            'message': {
                'to': phone,
                'from': sender,
                'text': f'[포켓몬카드샵] #{number}번 고객님, 입장해 주세요.\n추가 문의가 있으실 경우, 이 번호로 연락하셔도 대응하지 않습니다. 추가문의는 아래 번호로 연락주세요.\n050714919697',
            }
        }
        requests.post('https://api.solapi.com/messages/v4/send', json=body, headers=headers, timeout=5)
    except Exception:
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
        'is_open':       qs.is_open,
    }
    return Response(QueueStatusSerializer(data).data)


# ── 고객: 등록 ──
@api_view(['POST'])
def register(request):
    ser = RegisterSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    qs = _get_settings()

    # 受付中チェック
    if not qs.is_open:
        return Response({'detail': 'closed'}, status=status.HTTP_403_FORBIDDEN)

    # トークン検証
    if ser.validated_data['token'] != qs.registration_token:
        return Response({'detail': 'invalid token'}, status=status.HTTP_403_FORBIDDEN)

    phone     = ser.validated_data['phone']
    device_id = ser.validated_data.get('device_id', '')

    # 電話番号重複チェック（ステータス問わず）
    existing = Customer.objects.filter(phone=phone).first()
    if existing:
        data = CustomerSerializer(existing).data
        data['already_registered'] = True
        return Response(data, status=status.HTTP_200_OK)

    # デバイスID重複チェック
    if device_id:
        existing_device = Customer.objects.filter(device_id=device_id).first()
        if existing_device:
            data = CustomerSerializer(existing_device).data
            data['already_registered'] = True
            return Response(data, status=status.HTTP_200_OK)

    with transaction.atomic():
        # QueueSettingsをロックして採番をシリアライズ
        qs = QueueSettings.objects.select_for_update().get(pk=1)

        waiting_count = Customer.objects.filter(status=Customer.STATUS_WAITING).count()
        if waiting_count >= qs.max_count:
            return Response({'detail': 'full'}, status=status.HTTP_409_CONFLICT)

        last = Customer.objects.order_by('-number').first()
        number = (last.number + 1) if last else 1

        customer = Customer.objects.create(
            number=number,
            name=ser.validated_data['name'],
            phone=phone,
            device_id=device_id,
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
    batch = list(waiting[:1])
    if not batch:
        return Response({'detail': 'no waiting customers'}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()
    for customer in batch:
        customer.status    = Customer.STATUS_CALLED
        customer.called_at = now
        customer.save()
        _send_sms(customer.phone, customer.number)

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


# ── 관리자: 수신 시작 ──
@api_view(['POST'])
def admin_open(request):
    Customer.objects.all().delete()
    qs = _get_settings()
    qs.is_open = True
    qs.registration_token = secrets.token_urlsafe(32)
    qs.save()
    return Response(QueueSettingsSerializer(qs).data)


# ── 관리자: 수신 종료 ──
@api_view(['POST'])
def admin_close(request):
    qs = _get_settings()
    qs.is_open = False
    qs.registration_token = ''
    qs.save()
    return Response(QueueSettingsSerializer(qs).data)


# ── 고객: 등록 취소 ──
@api_view(['DELETE'])
def customer_cancel(request, number):
    try:
        customer = Customer.objects.get(number=number)
    except Customer.DoesNotExist:
        return Response({'detail': 'not found'}, status=status.HTTP_404_NOT_FOUND)
    if customer.status != Customer.STATUS_WAITING:
        return Response({'detail': 'already called'}, status=status.HTTP_400_BAD_REQUEST)
    customer.delete()
    return Response({'detail': 'cancelled'}, status=status.HTTP_200_OK)


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
