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
from .auth import bearer_session, json_body, require_role
from .models import (
    ActivationCode, AdminLoginThrottle, ApiSession, AuditEvent,
    ResidentCredential, Residential, Unit,
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
    if len(text) != 6 or not text.isdigit():
        raise ValueError("PIN_INVALIDO")
    return text

def _client_ip(request):
    forwarded = str(request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    return forwarded or str(request.META.get("REMOTE_ADDR") or "unknown")

def _admin_login_key(request, username):
    material = f"{str(username).strip().lower()}|{_client_ip(request)}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()

def _admin_login_blocked(key_hash):
    throttle = AdminLoginThrottle.objects.filter(key_hash=key_hash).first()
    if not throttle or not throttle.blocked_until:
        return None
    now = timezone.now()
    if throttle.blocked_until <= now:
        throttle.failed_attempts = 0
        throttle.blocked_until = None
        throttle.save(update_fields=["failed_attempts", "blocked_until", "updated_at"])
        return None
    return throttle

def _record_admin_failure(key_hash):
    now = timezone.now()
    with transaction.atomic():
        throttle, _ = AdminLoginThrottle.objects.select_for_update().get_or_create(key_hash=key_hash)
        if throttle.blocked_until and throttle.blocked_until > now:
            return throttle
        if throttle.blocked_until and throttle.blocked_until <= now:
            throttle.failed_attempts = 0
            throttle.blocked_until = None
        throttle.failed_attempts += 1
        if throttle.failed_attempts >= settings.ADMIN_LOGIN_MAX_ATTEMPTS:
            throttle.failed_attempts = 0
            throttle.blocked_until = now + timedelta(minutes=settings.ADMIN_LOGIN_BLOCK_MINUTES)
        throttle.save(update_fields=["failed_attempts", "blocked_until", "updated_at"])
        return throttle

def _retry_after_seconds(throttle):
    if not throttle or not throttle.blocked_until:
        return 0
    return max(1, int((throttle.blocked_until - timezone.now()).total_seconds()))

@csrf_exempt
def health(request):
    if request.method != "GET":
        return _json_error("METODO_INVALIDO", 405)
    return JsonResponse({"ok": True, "service": "conta-certa-api", "version": "0.12.0"})

@csrf_exempt
def admin_login(request):
    if request.method != "POST":
        return _json_error("METODO_INVALIDO", 405)

    body = json_body(request)
    username = str(body.get("username") or "").strip()
    password = str(body.get("password") or "")
    key_hash = _admin_login_key(request, username)

    blocked = _admin_login_blocked(key_hash)
    if blocked:
        return _json_error(
            "MUITAS_TENTATIVAS",
            429,
            retryAfterSeconds=_retry_after_seconds(blocked),
        )

    user = authenticate(username=username, password=password)
    if not user or not user.is_active or not user.is_staff:
        failed = _record_admin_failure(key_hash)
        if failed.blocked_until and failed.blocked_until > timezone.now():
            return _json_error(
                "MUITAS_TENTATIVAS",
                429,
                retryAfterSeconds=_retry_after_seconds(failed),
            )
        return _json_error("CREDENCIAIS_INVALIDAS", 401)

    AdminLoginThrottle.objects.filter(key_hash=key_hash).delete()
    token = ApiSession.issue(
        role=ApiSession.ROLE_ADMIN,
        user=user,
        expires_at=timezone.now() + timedelta(hours=settings.SESSION_HOURS),
    )
    AuditEvent.objects.create(
        actor_role="admin",
        actor=user.username,
        action="ADMIN_LOGIN_SUCCESS",
        detail={},
    )
    return JsonResponse({"token": token, "expiresInHours": settings.SESSION_HOURS})

@csrf_exempt
@require_role(ApiSession.ROLE_ADMIN)
def admin_sync_push(request):
    if request.method != "POST":
        return _json_error("METODO_INVALIDO", 405)
    body = json_body(request)
    snapshot = body.get("snapshot")
    try:
        base_version = int(body.get("baseVersion") or 0)
        if base_version < 0:
            raise ValueError
    except (TypeError, ValueError):
        return _json_error("VERSAO_BASE_INVALIDA")

    if not isinstance(snapshot, dict):
        return _json_error("SNAPSHOT_INVALIDO")
    residential_values = ((snapshot.get("stores") or {}).get("residential") or [])
    if not residential_values:
        return _json_error("SNAPSHOT_SEM_RESIDENCIAL")
    first = residential_values[0].get("value") if isinstance(residential_values[0], dict) else None
    external_id = str((first or {}).get("id") or "").strip()
    if not external_id:
        return _json_error("RESIDENCIAL_SEM_ID")

    existing = Residential.objects.filter(external_id=external_id).first()
    if existing and base_version != existing.sync_version:
        return JsonResponse(
            {"error": "VERSAO_DESATUALIZADA", "serverVersion": existing.sync_version},
            status=409,
        )
    try:
        residential = apply_admin_snapshot(snapshot, actor=request.api_session.user.username)
    except (ValueError, TypeError) as exc:
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

    now = timezone.now()
    ActivationCode.objects.filter(
        credential=credential,
        used_at__isnull=True,
    ).delete()
    ActivationCode.objects.filter(expires_at__lt=now - timedelta(days=7)).delete()

    raw = "CCA-" + secrets.token_urlsafe(18).replace("-", "").replace("_", "")[:20].upper()
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    expires = now + timedelta(hours=24)
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

    with transaction.atomic():
        activation = ActivationCode.objects.select_for_update().select_related(
            "credential__unit__residential"
        ).filter(
            credential__phone_digits=phone,
            credential__active=True,
            credential__unit__active=True,
            code_hash=digest,
            used_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).first()
        if not activation:
            return _json_error("ATIVACAO_INVALIDA", 401)

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

    AuditEvent.objects.create(
        residential=credential.unit.residential,
        actor_role="resident",
        actor=f"unit:{credential.unit.external_id}",
        action="RESIDENT_ACTIVATED",
        detail={"phoneSuffix": phone[-4:]},
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

    now = timezone.now()
    with transaction.atomic():
        candidates = list(
            ResidentCredential.objects.select_for_update().select_related(
                "unit__residential"
            ).filter(
                phone_digits=phone,
                active=True,
                unit__active=True,
            )[:2]
        )
        if len(candidates) > 1:
            return _json_error("TELEFONE_ASSOCIADO_A_MULTIPLAS_UNIDADES", 409)
        credential = candidates[0] if candidates else None
        if not credential or not credential.pin_hash:
            return _json_error("LOGIN_INVALIDO", 401)

        if credential.blocked_until and credential.blocked_until > now:
            return _json_error(
                "ACESSO_TEMPORARIAMENTE_BLOQUEADO",
                429,
                blockedUntil=credential.blocked_until.isoformat(),
            )
        if credential.blocked_until and credential.blocked_until <= now:
            credential.failed_attempts = 0
            credential.blocked_until = None

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
@require_role(ApiSession.ROLE_ADMIN)
def admin_sessions(request):
    if request.method != "GET":
        return _json_error("METODO_INVALIDO", 405)

    now = timezone.now()
    ApiSession.objects.filter(expires_at__lte=now).delete()
    sessions = ApiSession.objects.select_related(
        "user",
        "credential__unit__residential",
    ).filter(
        revoked_at__isnull=True,
        expires_at__gt=now,
    ).order_by("-created_at")[:200]

    items = []
    for session in sessions:
        actor = ""
        unit_id = ""
        residential_id = ""
        if session.role == ApiSession.ROLE_ADMIN and session.user:
            actor = session.user.username
        elif session.role == ApiSession.ROLE_RESIDENT and session.credential:
            unit = session.credential.unit
            actor = unit.label
            unit_id = unit.external_id
            residential_id = unit.residential.external_id
        items.append({
            "id": session.id,
            "role": session.role,
            "actor": actor,
            "unitId": unit_id,
            "residentialId": residential_id,
            "createdAt": session.created_at.isoformat(),
            "expiresAt": session.expires_at.isoformat(),
            "current": session.id == request.api_session.id,
        })
    return JsonResponse({"sessions": items})

@csrf_exempt
@require_role(ApiSession.ROLE_ADMIN)
def admin_revoke_session(request):
    if request.method != "POST":
        return _json_error("METODO_INVALIDO", 405)
    body = json_body(request)
    try:
        session_id = int(body.get("sessionId"))
        if session_id <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return _json_error("SESSAO_INVALIDA")

    target = ApiSession.objects.select_related(
        "credential__unit__residential"
    ).filter(
        id=session_id,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
    if not target:
        return _json_error("SESSAO_NAO_ENCONTRADA", 404)

    target.revoked_at = timezone.now()
    target.save(update_fields=["revoked_at"])

    residential = (
        target.credential.unit.residential
        if target.credential_id
        else None
    )
    AuditEvent.objects.create(
        residential=residential,
        actor_role="admin",
        actor=request.api_session.user.username,
        action="SESSION_REVOKED",
        detail={"sessionId": target.id, "role": target.role},
    )
    return JsonResponse({"ok": True, "revokedSessionId": target.id})

@csrf_exempt
def logout(request):
    if request.method != "POST":
        return _json_error("METODO_INVALIDO", 405)
    session = bearer_session(request)
    if session:
        actor = ""
        residential = None
        if session.role == ApiSession.ROLE_ADMIN and session.user:
            actor = session.user.username
        elif session.role == ApiSession.ROLE_RESIDENT and session.credential:
            actor = f"unit:{session.credential.unit.external_id}"
            residential = session.credential.unit.residential
        AuditEvent.objects.create(
            residential=residential,
            actor_role=session.role,
            actor=actor,
            action="LOGOUT",
            detail={"sessionId": session.id},
        )
        session.revoked_at = timezone.now()
        session.save(update_fields=["revoked_at"])
    return JsonResponse({"ok": True})
