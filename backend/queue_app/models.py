from django.db import models


class QueueSettings(models.Model):
    max_count = models.IntegerField(default=100)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '대기 설정'

    def __str__(self):
        return f'최대 {self.max_count}명'


class Customer(models.Model):
    STATUS_WAITING = 'waiting'
    STATUS_CALLED  = 'called'
    STATUS_CHOICES = [
        (STATUS_WAITING, '대기중'),
        (STATUS_CALLED,  '호출완료'),
    ]

    number            = models.IntegerField(unique=True)
    name              = models.CharField(max_length=100)
    phone             = models.CharField(max_length=20)
    status            = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_WAITING)
    push_subscription = models.JSONField(null=True, blank=True)
    registered_at     = models.DateTimeField(auto_now_add=True)
    called_at         = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = '고객'
        ordering = ['number']

    def __str__(self):
        return f'#{self.number} {self.name}'

    @property
    def position(self):
        return Customer.objects.filter(
            status=Customer.STATUS_WAITING,
            number__lt=self.number
        ).count() + 1
