from django.urls import path
from . import views

urlpatterns = [
    # 고객 API
    path('stores/',                     views.stores,            name='lottery-stores'),
    path('register/',                   views.lottery_register,  name='lottery-register'),
    path('receipt/<uuid:token>/',       views.applicant_receipt, name='lottery-receipt'),
    path('receipt/<uuid:token>/cancel/', views.lottery_cancel,   name='lottery-cancel'),
    path('status/<slug:code>/',         views.lottery_status,    name='lottery-status'),

    # 관리자 API (매장별)
    path('admin/<slug:code>/applicants/', views.admin_applicants, name='lottery-admin-applicants'),
    path('admin/<slug:code>/audit/',      views.admin_audit,      name='lottery-admin-audit'),
    path('admin/<slug:code>/applicant/<int:entry_no>/pickup/', views.admin_pickup, name='lottery-admin-pickup'),
    path('admin/<slug:code>/open/',       views.admin_open,       name='lottery-admin-open'),
    path('admin/<slug:code>/close/',      views.admin_close,      name='lottery-admin-close'),
    path('admin/<slug:code>/reset/',      views.admin_reset,      name='lottery-admin-reset'),
    path('admin/<slug:code>/export/',     views.admin_export,     name='lottery-admin-export'),
    path('admin/<slug:code>/import/',     views.admin_import,     name='lottery-admin-import'),
    path('admin/<slug:code>/send-sms/',   views.admin_send_sms,   name='lottery-admin-send-sms'),
]
