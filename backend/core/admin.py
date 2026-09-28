from django.contrib import admin
from .models import (
    Residential, Unit, ResidentCredential, ActivationCode, ApiSession,
    Obligation, Payment, Movement, Closing, Certificate, AuditEvent,
    AdminLoginThrottle,
)

for model in [
    Residential, Unit, ResidentCredential, ActivationCode, ApiSession,
    Obligation, Payment, Movement, Closing, Certificate, AuditEvent,
    AdminLoginThrottle,
]:
    admin.site.register(model)
