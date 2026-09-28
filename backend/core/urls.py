from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health),
    path("auth/admin/login/", views.admin_login),
    path("auth/resident/activate/", views.resident_activate),
    path("auth/resident/login/", views.resident_login),
    path("auth/logout/", views.logout),
    path("admin/sync/push/", views.admin_sync_push),
    path("admin/sync/pull/", views.admin_sync_pull),
    path("admin/residents/activation/", views.issue_activation),
    path("admin/sessions/", views.admin_sessions),
    path("admin/sessions/revoke/", views.admin_revoke_session),
    path("resident/snapshot/", views.resident_snapshot_view),
]
