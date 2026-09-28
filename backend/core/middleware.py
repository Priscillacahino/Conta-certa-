from django.conf import settings
from django.http import JsonResponse

class CorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = (request.headers.get("Origin") or "").rstrip("/")
        allowed = not origin or origin in settings.CORS_ALLOWED_ORIGINS

        if origin and not allowed:
            response = JsonResponse({"error": "ORIGEM_NAO_AUTORIZADA"}, status=403)
        elif request.method == "OPTIONS":
            from django.http import HttpResponse
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        if origin and allowed:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response["Access-Control-Max-Age"] = "600"

        if request.path.startswith("/api/"):
            response["Cache-Control"] = "no-store"
            response["Pragma"] = "no-cache"
        return response
