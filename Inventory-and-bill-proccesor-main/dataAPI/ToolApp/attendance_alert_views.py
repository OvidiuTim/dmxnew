import json
from datetime import date, datetime

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ToolApp.attendance_alert_escalation import ensure_default_configs, refresh_resolutions
from ToolApp.models import (
    AppUser,
    AttendanceAlertCase,
    AttendanceAlertDispatch,
    AttendanceAlertEscalationConfig,
    AttendanceAlertEscalationNotification,
    AttendanceAlertRunLog,
)


def _parse_day(raw):
    try:
        return date.fromisoformat(str(raw or ""))
    except ValueError:
        return timezone.localdate()


def _time_value(raw, fallback):
    try:
        return datetime.strptime(str(raw or ""), "%H:%M").time()
    except ValueError:
        return fallback


def _serialize_config(config):
    return {
        "level": config.level,
        "role_name": config.role_name,
        "app_user_id": config.app_user_id,
        "app_user_name": config.app_user.employee.UserName if config.app_user_id else "",
        "email": config.email,
        "alert_time": config.alert_time.strftime("%H:%M"),
        "active": config.active,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }


def _payload(work_date):
    refresh_resolutions(work_date)
    configs = ensure_default_configs()
    cases = list(
        AttendanceAlertCase.objects.filter(work_date=work_date)
        .select_related("employee", "team", "team__leader", "resolved_by", "resolved_by__employee")
        .order_by("level", "team__name", "employee__UserName")
    )
    app_users = AppUser.objects.filter(is_active=True).select_related("employee").order_by("employee__UserName")
    notifications = AttendanceAlertEscalationNotification.objects.filter(work_date=work_date).select_related(
        "recipient", "recipient__employee"
    )
    dispatches = AttendanceAlertDispatch.objects.filter(work_date=work_date).select_related("recipient")
    runs = AttendanceAlertRunLog.objects.filter(work_date=work_date)[:100]
    counts = {
        "initial": sum(1 for row in cases if row.level == 0),
        "level_1": sum(1 for row in cases if row.level == 1),
        "level_2": sum(1 for row in cases if row.level == 2),
        "resolved": sum(1 for row in cases if row.resolved_at),
        "active": sum(1 for row in cases if not row.resolved_at),
    }
    return {
        "date": work_date.isoformat(),
        "timezone": "Europe/Bucharest",
        "counts": counts,
        "configs": [_serialize_config(row) for row in configs],
        "app_users": [
            {
                "id": row.AppUserId,
                "username": row.username,
                "name": row.employee.UserName,
                "email": row.employee.email or "",
            }
            for row in app_users
        ],
        "cases": [
            {
                "id": row.pk,
                "level": row.level,
                "level_label": row.get_level_display(),
                "employee_id": row.employee_id,
                "employee_name": row.employee.UserName,
                "employee_phone": row.employee.phone_number or "",
                "team_id": row.team_id,
                "team_name": row.team.name,
                "worksite": row.worksite or "Fără șantier asignat",
                "leader_name": row.team.leader.UserName,
                "created_at": row.created_at.isoformat(),
                "resolved": bool(row.resolved_at),
                "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
                "resolution_method": row.resolution_method,
                "resolution_label": row.get_resolution_method_display() if row.resolution_method else "",
                "resolved_by": row.resolved_by.employee.UserName if row.resolved_by_id else "Sistem",
            }
            for row in cases
        ],
        "notifications": [
            {
                "id": row.pk,
                "level": row.level,
                "recipient": row.recipient.employee.UserName,
                "case_count": row.case_count,
                "created_at": row.created_at.isoformat(),
                "read_at": row.read_at.isoformat() if row.read_at else None,
            }
            for row in notifications
        ],
        "dispatches": [
            {
                "level": row.level,
                "role_name": row.role_name,
                "recipient": row.recipient.username if row.recipient_id else "",
                "email": row.email,
                "notification_sent_at": row.notification_sent_at.isoformat() if row.notification_sent_at else None,
                "email_sent_at": row.email_sent_at.isoformat() if row.email_sent_at else None,
                "error": row.error,
            }
            for row in dispatches
        ],
        "runs": [
            {
                "id": row.pk,
                "level": row.level,
                "status": row.status,
                "case_count": row.case_count,
                "started_at": row.started_at.isoformat(),
                "finished_at": row.finished_at.isoformat() if row.finished_at else None,
                "recipients": row.recipients,
                "emails_sent": row.emails_sent,
                "errors": row.errors,
            }
            for row in runs
        ],
    }


@csrf_exempt
@require_http_methods(["GET", "PUT"])
def attendance_alerts(request):
    if request.method == "GET":
        return JsonResponse(_payload(_parse_day(request.GET.get("date"))))

    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON invalid."}, status=400)
    levels = body.get("configs")
    if not isinstance(levels, list):
        return JsonResponse({"error": "Câmpul configs trebuie să fie o listă."}, status=400)
    existing = {row.level: row for row in ensure_default_configs()}
    for item in levels:
        try:
            level = int(item.get("level"))
        except (TypeError, ValueError):
            return JsonResponse({"error": "Nivel invalid."}, status=400)
        if level not in (1, 2):
            return JsonResponse({"error": "Sunt acceptate numai nivelurile 1 și 2."}, status=400)
        config = existing[level]
        raw_user_id = item.get("app_user_id")
        app_user = None
        if raw_user_id not in (None, ""):
            try:
                app_user = AppUser.objects.select_related("employee").get(AppUserId=int(raw_user_id), is_active=True)
            except (AppUser.DoesNotExist, TypeError, ValueError):
                return JsonResponse({"error": f"Utilizator invalid pentru Nivelul {level}."}, status=400)
        config.role_name = str(item.get("role_name") or f"Nivel {level}").strip()[:120]
        config.app_user = app_user
        supplied_email = str(item.get("email") or "").strip()
        config.email = supplied_email or (app_user.employee.email if app_user else "")
        config.alert_time = _time_value(item.get("alert_time"), config.alert_time)
        config.active = bool(item.get("active", True))
        config.save()
    return JsonResponse(_payload(_parse_day(body.get("date"))))
