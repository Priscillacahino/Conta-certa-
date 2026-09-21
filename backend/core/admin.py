from django.contrib import admin
from .models import (
    Residential, Unit, ResidentCredential, ActivationCode, ApiSession,
    Obligation, Payment, Movement, Closing, Certificate, AuditEvent,
)

for model in [
    Residential, Unit, ResidentCredential, ActivationCode, ApiSession,
    Obligation, Payment, Movement, Closing, Certificate, AuditEvent,
]:
    admin.site.register(model)
