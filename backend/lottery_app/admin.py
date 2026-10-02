from django.contrib import admin

from .models import Store, LotterySettings, LotteryApplicant


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'created_at')
    search_fields = ('name', 'code')


@admin.register(LotterySettings)
class LotterySettingsAdmin(admin.ModelAdmin):
    list_display = ('store', 'is_open', 'max_per_phone', 'updated_at')


@admin.register(LotteryApplicant)
class LotteryApplicantAdmin(admin.ModelAdmin):
    list_display = ('store', 'entry_no', 'name', 'phone', 'birthdate', 'has_children', 'is_winner', 'notified_at')
    list_filter = ('store', 'is_winner', 'has_children')
    search_fields = ('name', 'phone')
