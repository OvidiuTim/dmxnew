from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def backend_health(request):
    """Check Django and its database; never expose configuration or employee data."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        response = JsonResponse({"ok": False}, status=503)
    else:
        response = JsonResponse({"ok": True})
    response["Cache-Control"] = "no-store"
    return response
