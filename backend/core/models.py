import hashlib
import secrets
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

def token_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

class Residential(models.Model):
    external_id = models.CharField(max_length=120, unique=True)
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True)
    sync_version = models.PositiveBigIntegerField(default=0)
    latest_snapshot = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

class Unit(models.Model):
    residential = models.ForeignKey(Residential, on_delete=models.CASCADE, related_name="units")
    external_id = models.CharField(max_length=120)
    label = models.CharField(max_length=160)
    responsible_name = models.CharField(max_length=200, blank=True)
    active = models.BooleanField(default=True)
    payload = models.JSONField(default=dict)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["residential", "external_id"], name="uniq_unit_external")]

class ResidentCredential(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="credentials")
    phone_digits = models.CharField(max_length=15, db_index=True)
    pin_hash = models.CharField(max_length=256, blank=True)
    active = models.BooleanField(default=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    blocked_until = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["unit", "phone_digits"], name="uniq_unit_phone")]

class ActivationCode(models.Model):
    credential = models.ForeignKey(ResidentCredential, on_delete=models.CASCADE, related_name="activation_codes")
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ApiSession(models.Model):
    ROLE_ADMIN = "admin"
    ROLE_RESIDENT = "resident"
    ROLE_CHOICES = [(ROLE_ADMIN, "Administrador"), (ROLE_RESIDENT, "Morador")]
    token_hash = models.CharField(max_length=64, unique=True)
    role = models.CharField(max_length=16, choices=ROLE_CHOICES)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE)
    credential = models.ForeignKey(ResidentCredential, null=True, blank=True, on_delete=models.CASCADE)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def issue(cls, *, role, expires_at, user=None, credential=None):
        raw = secrets.token_urlsafe(32)
        cls.objects.create(
            token_hash=token_hash(raw),
            role=role,
            user=user,
            credential=credential,
            expires_at=expires_at,
        )
        return raw

    @property
    def active(self):
        return self.revoked_at is None and self.expires_at > timezone.now()

class Obligation(models.Model):
    residential = models.ForeignKey(Residential, on_delete=models.CASCADE)
    external_id = models.CharField(max_length=160)
    unit_external_id = models.CharField(max_length=120, db_index=True)
    kind = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=32, blank=True)
    amount_cents = models.BigIntegerField(default=0)
    paid_cents = models.BigIntegerField(default=0)
    due_date = models.DateField(null=True, blank=True)
    payload = models.JSONField(default=dict)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["residential", "external_id"], name="uniq_obligation_external")]

class Payment(models.Model):
    residential = models.ForeignKey(Residential, on_delete=models.CASCADE)
    external_id = models.CharField(max_length=160)
    obligation_external_id = models.CharField(max_length=160, blank=True)
    unit_external_id = models.CharField(max_length=120, db_index=True)
    amount_cents = models.BigIntegerField(default=0)
    paid_at = models.DateTimeField(null=True, blank=True)
    payload = models.JSONField(default=dict)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["residential", "external_id"], name="uniq_payment_external")]

class Movement(models.Model):
    residential = models.ForeignKey(Residential, on_delete=models.CASCADE)
    external_id = models.CharField(max_length=160)
    competence = models.CharField(max_length=7, db_index=True)
    kind = models.CharField(max_length=16)
    amount_cents = models.BigIntegerField(default=0)
    date = models.DateField(null=True, blank=True)
    payload = models.JSONField(default=dict)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["residential", "external_id"], name="uniq_movement_external")]

class Closing(models.Model):
    residential = models.ForeignKey(Residential, on_delete=models.CASCADE)
    competence = models.CharField(max_length=7)
    status = models.CharField(max_length=32, default="closed")
    revision = models.PositiveIntegerField(default=1)
    opening_balance_cents = models.BigIntegerField(default=0)
    revenue_cents = models.BigIntegerField(default=0)
    expense_cents = models.BigIntegerField(default=0)
    result_cents = models.BigIntegerField(default=0)
    closing_balance_cents = models.BigIntegerField(default=0)
    payload = models.JSONField(default=dict)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["residential", "competence"], name="uniq_closing_competence")]

class Certificate(models.Model):
    residential = models.ForeignKey(Residential, on_delete=models.CASCADE)
    certificate_id = models.CharField(max_length=180, unique=True)
    unit_external_id = models.CharField(max_length=120, db_index=True)
    year = models.PositiveIntegerField()
    status = models.CharField(max_length=32)
    file_name = models.CharField(max_length=240, blank=True)
    pdf_base64 = models.TextField(blank=True)
    payload = models.JSONField(default=dict)

class AuditEvent(models.Model):
    residential = models.ForeignKey(Residential, null=True, blank=True, on_delete=models.SET_NULL)
    actor_role = models.CharField(max_length=16)
    actor = models.CharField(max_length=200, blank=True)
    action = models.CharField(max_length=100)
    detail = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
