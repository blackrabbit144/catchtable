import uuid

from django.db import models


class Store(models.Model):
    """추첨을 운영하는 매장. 매장별로 응모·QR·관리가 분리된다."""
    name       = models.CharField(max_length=100)
    code       = models.SlugField(max_length=50, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '매장'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.code})'


class LotterySettings(models.Model):
    """매장별 추첨 접수 설정 (QueueSettings 와 동형, store 로 스코프)."""
    store              = models.OneToOneField(Store, on_delete=models.CASCADE, related_name='lottery_settings')
    is_open            = models.BooleanField(default=False)
    registration_token = models.CharField(max_length=64, blank=True, default='')
    max_per_phone      = models.IntegerField(default=10)
    updated_at         = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '추첨 설정'

    def __str__(self):
        return f'{self.store.code} 설정 (max_per_phone={self.max_per_phone})'


class LotteryApplicant(models.Model):
    """추첨 응모자. entry_no 는 매장 내 고유번호."""
    store         = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='applicants')
    entry_no      = models.IntegerField()
    public_token  = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name          = models.CharField(max_length=100)
    phone         = models.CharField(max_length=20)
    birthdate     = models.DateField()
    has_children  = models.BooleanField(default=False)
    children_count = models.IntegerField(default=0)   # 부모 행: 동반 자녀 수
    is_child      = models.BooleanField(default=False) # 자녀 행 여부
    device_id     = models.CharField(max_length=64, blank=True, default='')
    is_winner     = models.BooleanField(default=False)
    notified_at   = models.DateTimeField(null=True, blank=True)
    picked_up_at  = models.DateTimeField(null=True, blank=True)  # 상품 수령 완료 일시
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '응모자'
        ordering = ['store', 'entry_no']
        constraints = [
            models.UniqueConstraint(fields=['store', 'entry_no'], name='uniq_store_entry_no'),
        ]

    def __str__(self):
        return f'[{self.store.code}] #{self.entry_no} {self.name}'
