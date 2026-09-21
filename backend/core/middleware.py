from django.conf import settings

class CorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS":
            from django.http import HttpResponse
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        origin = (request.headers.get("Origin") or "").rstrip("/")
        if origin and origin in settings.CORS_ALLOWED_ORIGINS:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response["Access-Control-Max-Age"] = "600"
        return response
