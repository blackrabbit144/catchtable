"""Solapi SMS 전송 공용 헬퍼. queue_app / lottery_app 에서 공유한다."""
import hashlib
import hmac
import secrets
import time

import requests
from django.conf import settings


def send_sms(phone: str, text: str) -> bool:
    """단일 SMS 전송. 성공 시 True. LOAD_TEST_MODE 또는 설정 미비 시 전송하지 않고 False."""
    if getattr(settings, 'LOAD_TEST_MODE', False):
        return False
    api_key = settings.SOLAPI_API_KEY
    api_secret = settings.SOLAPI_API_SECRET
    sender = settings.SOLAPI_SENDER
    if not api_key or not api_secret or not sender:
        return False
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
                'text': text,
            }
        }
        res = requests.post(
            'https://api.solapi.com/messages/v4/send', json=body, headers=headers, timeout=5
        )
        return res.ok
    except Exception:
        return False
