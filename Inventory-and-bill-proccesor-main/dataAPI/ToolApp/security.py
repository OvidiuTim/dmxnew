import json

from django.conf import settings
from django.core import signing
from django.http import JsonResponse


TOKEN_SALT = "pontaj-auth"
TOKEN_AGE = 24 * 3600

PUBLIC_API_PREFIXES = (
    "/api/auth/login/",
    "/api/auth/verify/",
    "/api/app/version/",
    "/api/nfc/scan/",
    "/api/pontaj/login/",
    "/api/pontaj/clock/",
    "/api/pontaj/stream/",
)


def _normalize_public_path(path: str) -> str:
    path = path or "/"
    return path if path.endswith("/") else f"{path}/"


def make_admin_token():
    return signing.dumps({"k": "pontaj", "v": 2, "role": "admin"}, salt=TOKEN_SALT)


def check_admin_token(token: str) -> bool:
    if not token:
        return False
    try:
        data = signing.loads(token, salt=TOKEN_SALT, max_age=TOKEN_AGE)
    except (signing.SignatureExpired, signing.BadSignature):
        return False
    return data.get("k") == "pontaj" and data.get("role") == "admin"


def get_token_from_request(request):
    auth = request.META.get("HTTP_AUTHORIZATION") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()

    token = request.COOKIES.get("ptj")
    if token:
        return token

    if request.method == "POST":
        try:
            body = json.loads(request.body or "{}")
        except Exception:
            body = {}
        return body.get("token")

    return None


def request_has_admin(request) -> bool:
    return check_admin_token(get_token_from_request(request) or "")


class ApiAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS":
            return self.get_response(request)

        path = request.path_info or request.path
        if not path.startswith("/api/"):
            return self.get_response(request)

        if _normalize_public_path(path).startswith(PUBLIC_API_PREFIXES):
            return self.get_response(request)

        if request_has_admin(request):
            request.dmx_role = "admin"
            return self.get_response(request)

        return JsonResponse({"error": "Authentication required"}, status=401)
