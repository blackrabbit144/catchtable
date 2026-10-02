from rest_framework import serializers

from .models import Store, LotteryApplicant


class StoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = ['id', 'name', 'code']


class LotteryRegisterSerializer(serializers.Serializer):
    """응모 입력. store 는 URL/본문에서 code 로 받는다."""
    store          = serializers.SlugField(max_length=50)
    token          = serializers.CharField(max_length=64)
    name           = serializers.CharField(max_length=100)
    phone          = serializers.CharField(max_length=20)
    birthdate      = serializers.DateField()
    children_count = serializers.IntegerField(required=False, default=0, min_value=0)
    device_id      = serializers.CharField(max_length=64, required=False, allow_blank=True, default='')


class ReceiptSerializer(serializers.ModelSerializer):
    """고객용 명세서. 고유번호(entry_no)는 절대 포함하지 않는다."""
    store_name = serializers.CharField(source='store.name', read_only=True)

    class Meta:
        model = LotteryApplicant
        fields = ['public_token', 'store_name', 'name', 'phone', 'birthdate', 'children_count', 'registered_at']


class ApplicantAdminSerializer(serializers.ModelSerializer):
    """관리자용. 고유번호(entry_no) 포함."""
    class Meta:
        model = LotteryApplicant
        fields = [
            'entry_no', 'public_token', 'name', 'phone', 'birthdate',
            'children_count', 'is_child', 'is_winner', 'notified_at',
            'picked_up_at', 'registered_at',
        ]
