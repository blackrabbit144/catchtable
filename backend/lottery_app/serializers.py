from rest_framework import serializers

from .models import Store, LotteryApplicant, LotteryAuditLog


class StoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = ['id', 'name', 'code']


class ChildInputSerializer(serializers.Serializer):
    """동반 자녀 1명분 입력 (전화번호는 받지 않음 = 부모 번호 공유)."""
    name      = serializers.CharField(max_length=100)
    birthdate = serializers.DateField()


class LotteryRegisterSerializer(serializers.Serializer):
    """응모 입력. store 는 URL/본문에서 code 로 받는다."""
    store     = serializers.SlugField(max_length=50)
    token     = serializers.CharField(max_length=64)
    name      = serializers.CharField(max_length=100)
    phone     = serializers.CharField(max_length=20)
    birthdate = serializers.DateField()
    children  = ChildInputSerializer(many=True, required=False, default=list)
    device_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default='')


class ReceiptSerializer(serializers.ModelSerializer):
    """고객용 명세서. 고유번호(entry_no)는 절대 포함하지 않는다."""
    store_name = serializers.CharField(source='store.name', read_only=True)
    children   = serializers.SerializerMethodField()

    class Meta:
        model = LotteryApplicant
        fields = ['public_token', 'store_name', 'name', 'phone', 'birthdate',
                  'children_count', 'children', 'registered_at']

    def get_children(self, obj):
        # 부모 명세서에 동반 자녀(이름·생년월일)를 함께 보여준다 (직원 확인용)
        if obj.is_child:
            return []
        kids = LotteryApplicant.objects.filter(
            store=obj.store, phone=obj.phone, is_child=True,
        ).order_by('entry_no')
        return [{'name': k.name, 'birthdate': k.birthdate} for k in kids]


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = LotteryAuditLog
        fields = ['action', 'name', 'phone', 'entry_no', 'children_count', 'note', 'created_at']


class ApplicantAdminSerializer(serializers.ModelSerializer):
    """관리자용. 고유번호(entry_no) 포함."""
    class Meta:
        model = LotteryApplicant
        fields = [
            'entry_no', 'public_token', 'name', 'phone', 'birthdate',
            'children_count', 'is_child', 'is_winner', 'notified_at',
            'picked_up_at', 'registered_at',
        ]
