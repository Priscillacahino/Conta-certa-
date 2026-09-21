import json
from functools import wraps
from django.http import JsonResponse
from django.utils import timezone
from .models import ApiSession, token_hash

def json_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return {}

def bearer_session(request):
    header = request.headers.get("Authorization") or ""
    if not header.startswith("Bearer "):
        return None
    raw = header[7:].strip()
    if not raw:
        return None
    session = ApiSession.objects.select_related("user", "credential__unit__residential").filter(
        token_hash=token_hash(raw),
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()
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
