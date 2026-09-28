import json
from functools import wraps
from django.http import JsonResponse
from django.utils import timezone
from .models import ApiSession, token_hash

def json_body(request):
    try:
        value = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return {}
    return value if isinstance(value, dict) else {}

def bearer_session(request):
    header = request.headers.get("Authorization") or ""
    if not header.startswith("Bearer "):
        return None
    raw = header[7:].strip()
    if not raw:
        return None

    session = ApiSession.objects.select_related(
        "user",
        "credential__unit__residential",
    ).filter(
        token_hash=token_hash(raw),
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
    if not session:
        return None

    invalid = False
    if session.role == ApiSession.ROLE_ADMIN:
        invalid = not session.user or not session.user.is_active or not session.user.is_staff
    elif session.role == ApiSession.ROLE_RESIDENT:
        invalid = (
            not session.credential
            or not session.credential.active
            or not session.credential.unit.active
        )
    else:
        invalid = True

    if invalid:
        session.revoked_at = timezone.now()
        session.save(update_fields=["revoked_at"])
        return None
    return session

def require_role(role):
    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            session = bearer_session(request)
            if not session or session.role != role:
                return JsonResponse({"error": "NAO_AUTORIZADO"}, status=401)
            request.api_session = session
            return view(request, *args, **kwargs)
        return wrapped
    return decorator
