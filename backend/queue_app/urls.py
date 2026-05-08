from django.urls import path
from . import views

urlpatterns = [
    # 고객 API
    path('queue/status/',         views.queue_status,    name='queue-status'),
    path('register/',             views.register,        name='register'),
    path('customer/<int:number>/',views.customer_detail, name='customer-detail'),

    path('customer/<int:number>/subscription/', views.save_subscription, name='save-subscription'),

    # 관리자 API
    path('admin/customers/',      views.admin_customers, name='admin-customers'),
    path('admin/call/',           views.admin_call,      name='admin-call'),
    path('admin/settings/',       views.admin_settings,  name='admin-settings'),
    path('admin/reset/',          views.admin_reset,     name='admin-reset'),
]
