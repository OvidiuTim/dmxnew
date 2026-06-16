import json

from django.conf import settings
from django.core import signing
from django.http import JsonResponse


TOKEN_SALT = "pontaj-auth"
APP_TOKEN_SALT = "dmx-app-user-auth"
TOKEN_AGE = 24 * 3600
APP_TOKEN_COOKIE = "appj"
ADMIN_APP_COOKIE = "app_admin"

PUBLIC_API_PREFIXES = (
    "/api/auth/login/",
    "/api/auth/verify/",
    "/api/auth/logout/",
    "/api/app-auth/login/",
    "/api/app-auth/verify/",
    "/api/app-auth/logout/",
    "/api/app-admin/",
    "/api/nfc/scan/",
    "/api/pontaj/login/",
    "/api/pontaj/clock/",
    "/api/pontaj/stream/",
)

API_ROUTE_REQUIREMENTS = (
    ("/api/tools/", ("/unelte", "/unelte/adauga-unealta", "/predare-unealta")),
    ("/api/tool/", ("/unelte", "/unelte/adauga-unealta", "/predare-unealta")),
    ("/api/user/", ("/pontaj", "/users/new", "/user/:id", "/angajati", "/pontaj/fisa-angajat")),
    ("/api/users/", ("/pontaj", "/users/new", "/angajati")),
    ("/api/pontaj/reports/", ("/pontaj/rapoarte",)),
    ("/api/pontaj/day/", ("/pontaj", "/pontaj/rapoarte")),
    ("/api/pontaj/present/", ("/pontaj", "/pontaj/rapoarte")),
    ("/api/pontaj/range/", ("/pontaj/rapoarte",)),
    ("/api/pontaj/today/", ("/pontaj",)),
    ("/api/pontaj/", ("/pontaj",)),
    ("/api/history/", ("/history", "/dashboard")),
    ("/api/material/", ("/materiale",)),
    ("/api/consumable/", ("/materiale",)),
    ("/api/shed/", ("/rafturi",)),
    ("/api/workfield/", ("/magazie",)),
    ("/api/unfunctional/", ("/magazie",)),
    ("/api/cofraj", ("/schela",)),
    ("/api/popi/", ("/schela",)),
    ("/api/schela", ("/schela",)),
    ("/api/mijloacefixe/", ("/magazie",)),
    ("/api/combustibil/", ("/magazie",)),
    ("/api/istoric_schele/", ("/history", "/schela")),
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


def make_app_user_token(app_user):
    return signing.dumps(
        {"k": "dmx-app-user", "v": 1, "app_user_id": app_user.AppUserId},
        salt=APP_TOKEN_SALT,
    )


def read_app_user_token(token: str):
    if not token:
        return None
    try:
        data = signing.loads(token, salt=APP_TOKEN_SALT, max_age=TOKEN_AGE)
    except (signing.SignatureExpired, signing.BadSignature):
        return None
    if data.get("k") != "dmx-app-user":
        return None
    return data


def get_app_token_from_request(request):
    return request.COOKIES.get(APP_TOKEN_COOKIE)


def get_app_user_from_request(request):
    data = read_app_user_token(get_app_token_from_request(request) or "")
    if not data:
        return None
    try:
        from ToolApp.models import AppUser
        return AppUser.objects.select_related("employee").get(
            AppUserId=data.get("app_user_id"),
            is_active=True,
        )
    except Exception:
        return None


def request_has_admin(request) -> bool:
    return check_admin_token(get_token_from_request(request) or "")


def app_user_has_route(app_user, route: str) -> bool:
    if not app_user or not route:
        return False
    from ToolApp.models import AppPagePermission
    return AppPagePermission.objects.filter(
        app_user=app_user,
        route=route,
        can_access=True,
    ).exists()


def app_user_can_access_any(app_user, routes) -> bool:
    return any(app_user_has_route(app_user, route) for route in routes)


def app_user_can_access_api_path(app_user, path: str) -> bool:
    normalized = _normalize_public_path(path)
    for prefix, routes in API_ROUTE_REQUIREMENTS:
        if normalized.startswith(prefix):
            return app_user_can_access_any(app_user, routes)
    return False


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

        app_user = get_app_user_from_request(request)
        if app_user:
            if app_user_can_access_api_path(app_user, path):
                request.dmx_role = "app_user"
                request.app_user = app_user
                return self.get_response(request)
            return JsonResponse({"error": "Forbidden for this app user"}, status=403)

        return JsonResponse({"error": "Authentication required"}, status=401)
