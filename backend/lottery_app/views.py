import secrets

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from common.sms import send_sms
from .excel import build_workbook, parse_winner_entry_nos
from .models import Store, LotterySettings, LotteryApplicant
from .serializers import (
    StoreSerializer, LotteryRegisterSerializer,
    ReceiptSerializer, ApplicantAdminSerializer,
)

DEFAULT_WINNER_SMS_TEXT = (
    '[포켓몬카드샵] 축하합니다! 추첨에 당첨되셨습니다.\n'
    '기간 내 매장으로 방문해 주세요.'
)


def _get_settings(store: Store) -> LotterySettings:
    obj, _ = LotterySettings.objects.get_or_create(store=store)
    return obj


# ── 고객: 매장 목록 ──
@api_view(['GET'])
def stores(request):
    return Response(StoreSerializer(Store.objects.all(), many=True).data)


# ── 고객: 접수 상태 확인 ──
@api_view(['GET'])
def lottery_status(request, code):
    store = get_object_or_404(Store, code=code)
    qs = _get_settings(store)
    return Response({
        'store': store.code,
        'store_name': store.name,
        'is_open': qs.is_open,
    })


# ── 고객: 응모 ──
@api_view(['POST'])
def lottery_register(request):
    ser = LotteryRegisterSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    data = ser.validated_data
    store = get_object_or_404(Store, code=data['store'])
    qs = _get_settings(store)

    if not qs.is_open:
        return Response({'detail': 'closed'}, status=status.HTTP_403_FORBIDDEN)
    if data['token'] != qs.registration_token:
        return Response({'detail': 'invalid token'}, status=status.HTTP_403_FORBIDDEN)

    phone          = data['phone']
    name           = data['name']
    birthdate      = data['birthdate']
    device_id      = data.get('device_id', '')
    children_count = data['children_count']

    with transaction.atomic():
        # 매장별 설정 행을 잠가 채번/중복판정을 직렬화
        qs = LotterySettings.objects.select_for_update().get(pk=qs.pk)

        # 부모 1 + 자녀 N 이 상한을 넘으면 거부
        if 1 + children_count > qs.max_per_phone:
            return Response({'detail': 'limit'}, status=status.HTTP_400_BAD_REQUEST)

        last = LotteryApplicant.objects.filter(store=store).order_by('-entry_no').first()
        base = last.entry_no if last else 0

        # 부모 행
        parent = LotteryApplicant.objects.create(
            store=store, entry_no=base + 1,
            name=name, phone=phone, birthdate=birthdate,
            has_children=children_count > 0, children_count=children_count,
            is_child=False, device_id=device_id,
        )
        # 자녀 행 (부모 정보 유용, 각자 추첨 1매) — 같은 번호 중복이지만 허용
        for i in range(children_count):
            LotteryApplicant.objects.create(
                store=store, entry_no=base + 2 + i,
                name=f'{name} (자녀 {i + 1})', phone=phone, birthdate=birthdate,
                has_children=False, children_count=0,
                is_child=True, device_id=device_id,
            )

        # 중복 정리: 자녀 표시가 없는(plain) 동일 번호 응모가 여러 개면
        # 최신(이번) 것만 남기고 이전 것을 자동 삭제한다.
        if children_count == 0:
            LotteryApplicant.objects.filter(
                store=store, phone=phone, is_child=False, children_count=0,
            ).exclude(pk=parent.pk).delete()

    # 고객 응답은 명세서용(고유번호 미포함) + 명세서 URL 토큰
    return Response(ReceiptSerializer(parent).data, status=status.HTTP_201_CREATED)


# ── 고객: 명세서 조회 (public_token) ──
@api_view(['GET'])
def applicant_receipt(request, token):
    applicant = get_object_or_404(LotteryApplicant, public_token=token)
    return Response(ReceiptSerializer(applicant).data)


# ── 고객: 응모 취소 (public_token) ──
@api_view(['DELETE'])
def lottery_cancel(request, token):
    """잘못 입력했을 때 본인이 취소. 같은 번호의 가족(부모+자녀) 응모를 함께 삭제."""
    applicant = get_object_or_404(LotteryApplicant, public_token=token)
    deleted, _ = LotteryApplicant.objects.filter(
        store=applicant.store, phone=applicant.phone,
    ).delete()
    return Response({'detail': 'cancelled', 'deleted': deleted}, status=status.HTTP_200_OK)


# ── 관리자: 응모자 목록 (매장별) ──
@api_view(['GET'])
def admin_applicants(request, code):
    store = get_object_or_404(Store, code=code)
    applicants = LotteryApplicant.objects.filter(store=store).order_by('entry_no')
    qs = _get_settings(store)
    return Response({
        'store': store.code,
        'store_name': store.name,
        'is_open': qs.is_open,
        'registration_token': qs.registration_token,
        'max_per_phone': qs.max_per_phone,
        'count': applicants.count(),
        'applicants': ApplicantAdminSerializer(applicants, many=True).data,
    })


# ── 관리자: 상품 수령 체크 토글 ──
@api_view(['POST'])
def admin_pickup(request, code, entry_no):
    store = get_object_or_404(Store, code=code)
    applicant = get_object_or_404(LotteryApplicant, store=store, entry_no=entry_no)
    picked = bool(request.data.get('picked_up', True))
    applicant.picked_up_at = timezone.now() if picked else None
    applicant.save(update_fields=['picked_up_at'])
    return Response({'entry_no': entry_no, 'picked_up_at': applicant.picked_up_at})


# ── 관리자: 접수 시작 (매장별 · 응모자 초기화 · 토큰 재발급) ──
@api_view(['POST'])
def admin_open(request, code):
    store = get_object_or_404(Store, code=code)
    LotteryApplicant.objects.filter(store=store).delete()
    qs = _get_settings(store)
    qs.is_open = True
    qs.registration_token = secrets.token_urlsafe(32)
    qs.save()
    return Response({'store': store.code, 'is_open': True, 'registration_token': qs.registration_token})


# ── 관리자: 접수 종료 (매장별) ──
@api_view(['POST'])
def admin_close(request, code):
    store = get_object_or_404(Store, code=code)
    qs = _get_settings(store)
    qs.is_open = False
    qs.registration_token = ''
    qs.save()
    return Response({'store': store.code, 'is_open': False})


# ── 관리자: 초기화 (매장별) ──
@api_view(['POST'])
def admin_reset(request, code):
    store = get_object_or_404(Store, code=code)
    LotteryApplicant.objects.filter(store=store).delete()
    return Response({'detail': 'reset complete'})


# ── 관리자: Excel 출력 (매장별) ──
@api_view(['GET'])
def admin_export(request, code):
    store = get_object_or_404(Store, code=code)
    applicants = LotteryApplicant.objects.filter(store=store).order_by('entry_no')
    content = build_workbook(applicants)
    resp = HttpResponse(
        content,
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    resp['Content-Disposition'] = f'attachment; filename="lottery_{store.code}.xlsx"'
    return resp


# ── 관리자: Excel 취입 → 당첨자 표시만 (SMS 는 별도 버튼) ──
@api_view(['POST'])
def admin_import(request, code):
    store = get_object_or_404(Store, code=code)
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'detail': 'no file'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        winner_entry_nos = parse_winner_entry_nos(file_obj)
    except Exception:
        return Response({'detail': 'invalid file'}, status=status.HTTP_400_BAD_REQUEST)

    marked = 0
    errors = []
    for entry_no in winner_entry_nos:
        try:
            applicant = LotteryApplicant.objects.get(store=store, entry_no=entry_no)
        except LotteryApplicant.DoesNotExist:
            errors.append(entry_no)
            continue
        if not applicant.is_winner:
            applicant.is_winner = True
            applicant.save(update_fields=['is_winner'])
        marked += 1

    total_winners = LotteryApplicant.objects.filter(store=store, is_winner=True).count()
    unsent = LotteryApplicant.objects.filter(
        store=store, is_winner=True, notified_at__isnull=True,
    ).count()

    return Response({
        'marked': marked,          # 이번 업로드로 당첨 표시된 건수
        'total_winners': total_winners,
        'unsent': unsent,          # 아직 SMS 미발송 당첨자 수
        'not_found': errors,
    })


# ── 관리자: 당첨자에게 SMS 발송 (입력한 문구로, 미발송자에게만) ──
@api_view(['POST'])
def admin_send_sms(request, code):
    store = get_object_or_404(Store, code=code)
    message = (request.data.get('message') or '').strip()
    if not message:
        return Response({'detail': 'empty message'}, status=status.HTTP_400_BAD_REQUEST)

    # 당첨자 중 아직 발송 안 된 사람 (중복 발송 방지)
    targets = list(LotteryApplicant.objects.filter(
        store=store, is_winner=True, notified_at__isnull=True,
    ).order_by('entry_no'))

    # 같은 전화번호(부모+자녀 등)는 대표 1건으로 묶어 1통만 발송
    groups = {}
    for a in targets:
        groups.setdefault(a.phone, []).append(a)

    sent = 0
    failed = 0
    now = timezone.now()
    for phone, members in groups.items():
        # {이름}=당첨자 성명(같은 번호의 당첨자 전원), {매장}=매장명
        names = ', '.join(m.name for m in members)
        text = message.replace('{이름}', names).replace('{매장}', store.name)
        if send_sms(phone, text):
            for m in members:
                m.notified_at = now
                m.save(update_fields=['notified_at'])
            sent += 1
        else:
            failed += 1

    return Response({
        'target': len(groups),      # 발송할 번호 수(= SMS 건수)
        'sent': sent,               # 성공한 번호 수
        'failed': failed,
        'recipients': len(targets), # 포함된 당첨자 수(참고)
    })
