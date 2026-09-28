from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("api/", include("core.urls")),
]

if settings.ENABLE_DJANGO_ADMIN:
    urlpatterns.insert(0, path("django-admin/", admin.site.urls))
