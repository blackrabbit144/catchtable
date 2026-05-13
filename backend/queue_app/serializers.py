from rest_framework import serializers
from .models import Customer, QueueSettings


class CustomerSerializer(serializers.ModelSerializer):
    position = serializers.IntegerField(read_only=True)

    class Meta:
        model = Customer
        fields = ['id', 'number', 'name', 'phone', 'status', 'position', 'registered_at', 'called_at']
        read_only_fields = ['id', 'number', 'status', 'registered_at', 'called_at']


class RegisterSerializer(serializers.Serializer):
    name              = serializers.CharField(max_length=100)
    phone             = serializers.CharField(max_length=20)
    device_id         = serializers.CharField(max_length=64, required=False, allow_blank=True, default='')
    push_subscription = serializers.JSONField(required=False, allow_null=True)
    token             = serializers.CharField(max_length=64)
    latitude          = serializers.FloatField(required=False, allow_null=True)
    longitude         = serializers.FloatField(required=False, allow_null=True)


class QueueStatusSerializer(serializers.Serializer):
    waiting_count = serializers.IntegerField()
    called_count  = serializers.IntegerField()
    max_count     = serializers.IntegerField()
    is_full       = serializers.BooleanField()
    is_open       = serializers.BooleanField()


class QueueSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = QueueSettings
        fields = ['max_count', 'is_open', 'registration_token', 'gps_enabled', 'latitude', 'longitude']
        read_only_fields = ['registration_token']
