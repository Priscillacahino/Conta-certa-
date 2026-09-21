import hashlib
import secrets
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from .auth import json_body, require_role
from .models import (
    ActivationCode, ApiSession, AuditEvent, ResidentCredential,
    Residential, Unit,
)
from .sync import apply_admin_snapshot, resident_snapshot

def _json_error(code, status=400, **extra):
    return JsonResponse({"error": code, **extra}, status=status)

def _phone(value):
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if not 10 <= len(digits) <= 15:
        raise ValueError("TELEFONE_INVALIDO")
    return digits

def _pin(value):
    text = str(value or "")
    if len(text) != 4 or not text.isdigit():
        raise ValueError("PIN_INVALIDO")
    return text

@csrf_exempt
def health(request):
    if request.method != "GET":
        return _json_error("METODO_INVALIDO", 405)
    return JsonResponse({"ok": True, "service": "conta-certa-api", "version": "0.11.0"})

@csrf_exempt
def admin_login(request):
    if request.method != "POST":
        return _json_error("METODO_INVALIDO", 405)
    body = json_body(request)
    user = authenticate(username=str(body.get("username") or ""), password=str(body.get("password") or ""))
    if not user or not user.is_active or not user.is_staff:
        return _json_error("CREDENCIAIS_INVALIDAS", 401)
    token = ApiSession.issue(
        role=ApiSession.ROLE_ADMIN,
        user=user,
        expires_at=timezone.now() + timedelta(hours=settings.SESSION_HOURS),
    )
    return JsonResponse({"token": token, "expiresInHours": settings.SESSION_HOURS})

@csrf_exempt
@require_role(ApiSession.ROLE_ADMIN)
def admin_sync_push(request):
    if request.method != "POST":
        return _json_error("METODO_INVALIDO", 405)
    body = json_body(request)
    snapshot = body.get("snapshot")
    base_version = int(body.get("baseVersion") or 0)
    if not isinstance(snapshot, dict):
        return _json_error("SNAPSHOT_INVALIDO")
    residential_values = ((snapshot.get("stores") or {}).get("residential") or [])
    if not residential_values:
        return _json_error("SNAPSHOT_SEM_RESIDENCIAL")
    first = residential_values[0].get("value") if isinstance(residential_values[0], dict) else None
    external_id = str((first or {}).get("id") or "")
    existing = Residential.objects.filter(external_id=external_id).first()
    if existing and base_version != existing.sync_version:
        return JsonResponse(
            {"error": "VERSAO_DESATUALIZADA", "serverVersion": existing.sync_version},
            status=409,
        )
    try:
        residential = apply_admin_snapshot(snapshot, actor=request.api_session.user.username)
    except ValueError as exc:
        return _json_error(str(exc))
    return JsonResponse({"ok": True, "syncVersion": residential.sync_version})

@csrf_exempt
@require_role(ApiSession.ROLE_ADMIN)
def admin_sync_pull(request):
    if request.method != "GET":
        return _json_error("METODO_INVALIDO", 405)
    residential_id = str(request.GET.get("residentialId") or "").strip()
    if residential_id:
        residential = Residential.objects.filter(external_id=residential_id).first()
    else:
        residential = Residential.objects.order_by("id").first()
    if not residential or not residential.latest_snapshot:
        return _json_error("BASE_REMOTA_NAO_ENCONTRADA", 404)
    return JsonResponse({
        "syncVersion": residential.sync_version,
        "snapshot": residential.latest_snapshot,
        "updatedAt": residential.updated_at.isoformat(),
    })

@csrf_exempt
@require_role(ApiSession.ROLE_ADMIN)
def issue_activation(request):
    if request.method != "POST":
        return _json_error("METODO_INVALIDO", 405)
    body = json_body(request)
    residential_id = str(body.get("residentialId") or "").strip()
    unit_id = str(body.get("unitId") or "").strip()
    try:
        phone = _phone(body.get("phone"))
    except ValueError as exc:
        return _json_error(str(exc))
    unit = Unit.objects.filter(
        residential__external_id=residential_id,
        external_id=unit_id,
        active=True,
    ).first()
    if not unit:
        return _json_error("UNIDADE_NAO_ENCONTRADA", 404)
    credential = ResidentCredential.objects.filter(unit=unit, phone_digits=phone, active=True).first()
    if not credential:
        return _json_error("TELEFONE_NAO_AUTORIZADO", 404)
    raw = "CCA-" + secrets.token_urlsafe(12).replace("-", "").replace("_", "")[:16].upper()
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    expires = timezone.now() + timedelta(hours=24)
    ActivationCode.objects.create(credential=credential, code_hash=digest, expires_at=expires)
    AuditEvent.objects.create(
        residential=unit.residential,
        actor_role="admin",
        actor=request.api_session.user.username,
        action="RESIDENT_ACTIVATION_ISSUED",
        detail={"unitId": unit.external_id, "phoneSuffix": phone[-4:]},
    )
    return JsonResponse({"activationCode": raw, "expiresAt": expires.isoformat()})

@csrf_exempt
def resident_activate(request):
    if request.method != "POST":
        return _json_error("METODO_INVALIDO", 405)
    body = json_body(request)
    try:
        phone = _phone(body.get("phone"))
        pin = _pin(body.get("pin"))
    except ValueError as exc:
        return _json_error(str(exc))
    code = str(body.get("activationCode") or "").strip()
    digest = hashlib.sha256(code.encode("utf-8")).hexdigest()
    activation = ActivationCode.objects.select_related("credential__unit__residential").filter(
        credential__phone_digits=phone,
        credential__active=True,
        code_hash=digest,
        used_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
    if not activation:
        return _json_error("ATIVACAO_INVALIDA", 401)
    with transaction.atomic():
        credential = activation.credential
        credential.pin_hash = make_password(pin)
        credential.failed_attempts = 0
        credential.blocked_until = None
        credential.save(update_fields=["pin_hash", "failed_attempts", "blocked_until", "updated_at"])
        activation.used_at = timezone.now()
        activation.save(update_fields=["used_at"])
        token = ApiSession.issue(
            role=ApiSession.ROLE_RESIDENT,
            credential=credential,
            expires_at=timezone.now() + timedelta(days=settings.RESIDENT_SESSION_DAYS),
        )
    return JsonResponse({"token": token, "snapshot": resident_snapshot(credential)})

@csrf_exempt
def resident_login(request):
    if request.method != "POST":
        return _json_error("METODO_INVALIDO", 405)
    body = json_body(request)
    try:
        phone = _phone(body.get("phone"))
        pin = _pin(body.get("pin"))
    except ValueError as exc:
        return _json_error(str(exc))

    candidates = list(ResidentCredential.objects.select_related("unit__residential").filter(
        phone_digits=phone, active=True
    )[:2])
    if len(candidates) > 1:
        return _json_error("TELEFONE_ASSOCIADO_A_MULTIPLAS_UNIDADES", 409)
    credential = candidates[0] if candidates else None
    if not credential or not credential.pin_hash:
        return _json_error("LOGIN_INVALIDO", 401)
    now = timezone.now()
    if credential.blocked_until and credential.blocked_until > now:
        return _json_error("ACESSO_TEMPORARIAMENTE_BLOQUEADO", 429, blockedUntil=credential.blocked_until.isoformat())
    if not check_password(pin, credential.pin_hash):
        credential.failed_attempts += 1
        if credential.failed_attempts >= 5:
            credential.blocked_until = now + timedelta(minutes=5)
            credential.failed_attempts = 0
        credential.save(update_fields=["failed_attempts", "blocked_until", "updated_at"])
        return _json_error("LOGIN_INVALIDO", 401)
    credential.failed_attempts = 0
    credential.blocked_until = None
    credential.save(update_fields=["failed_attempts", "blocked_until", "updated_at"])
    token = ApiSession.issue(
        role=ApiSession.ROLE_RESIDENT,
        credential=credential,
        expires_at=now + timedelta(days=settings.RESIDENT_SESSION_DAYS),
    )
    return JsonResponse({"token": token, "snapshot": resident_snapshot(credential)})

@csrf_exempt
@require_role(ApiSession.ROLE_RESIDENT)
def resident_snapshot_view(request):
    if request.method != "GET":
        return _json_error("METODO_INVALIDO", 405)
    return JsonResponse(resident_snapshot(request.api_session.credential))

@csrf_exempt
def logout(request):
    from .auth import bearer_session
    if request.method != "POST":
        return _json_error("METODO_INVALIDO", 405)
    session = bearer_session(request)
    if session:
        session.revoked_at = timezone.now()
        session.save(update_fields=["revoked_at"])
    return JsonResponse({"ok": True})
