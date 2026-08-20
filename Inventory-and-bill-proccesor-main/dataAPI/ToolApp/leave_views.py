import json

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from ToolApp.mobile_services import count_salary_days_in_range
from ToolApp.models import LeaveRequest
from ToolApp.security import get_app_user_from_request, request_has_admin
from ToolApp.leave_email import send_leave_approval_email


def _error(message, status=400, details=None):
    payload = {"error": message}
    if details:
        payload["details"] = details
    return JsonResponse(payload, status=status)


def _actor(request):
    if getattr(request, "dmx_role", None) == "admin" or request_has_admin(request):
        return None, True
    return getattr(request, "app_user", None) or get_app_user_from_request(request), False


def _base_queryset():
    return LeaveRequest.objects.select_related(
        "employee",
        "team",
        "team__supervisor",
        "assigned_leader",
        "reviewed_by_app_user__employee",
    )


def _visible_queryset(app_user, is_admin):
    queryset = _base_queryset()
    if is_admin:
        return queryset
    if not app_user:
        return queryset.none()
    return queryset.filter(
        Q(team__supervisor_id=app_user.employee_id)
        | Q(team__supervisor__isnull=True, team__leader_id=app_user.employee_id)
    )


def _employee_payload(employee):
    return {
        "id": employee.UserId,
        "name": employee.UserName,
        "serie": employee.UserSerie,
        "company": employee.Company or "",
        "trade": employee.trade or "",
        "photo": employee.photo or None,
    }


def _serialize(item, can_decide):
    reviewed_by = item.reviewed_by_app_user.employee if item.reviewed_by_app_user_id else None
    return {
        "id": item.pk,
        "employee": _employee_payload(item.employee),
        "team": {"id": item.team_id, "name": item.team.name} if item.team_id else None,
        "assigned_leader": {
            "id": item.assigned_leader_id,
            "name": item.assigned_leader.UserName,
        } if item.assigned_leader_id else None,
        "leave_type": item.leave_type,
        "leave_type_label": item.get_leave_type_display(),
        "start_date": item.start_date.isoformat(),
        "end_date": item.end_date.isoformat(),
        "reason": item.reason,
        "leave_days": count_salary_days_in_range(item.start_date, item.end_date),
        "status": item.status,
        "status_label": item.get_status_display(),
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "reviewed_at": item.reviewed_at.isoformat() if item.reviewed_at else None,
        "approved_at": item.approved_at.isoformat() if item.approved_at else None,
        "reviewed_by": _employee_payload(reviewed_by) if reviewed_by else None,
        "can_decide": bool(can_decide and item.status == LeaveRequest.Status.PENDING),
    }


@csrf_exempt
def leave_requests_collection(request):
    if request.method != "GET":
        return _error("Metodă nepermisă.", 405)
    app_user, is_admin = _actor(request)
    if not is_admin and not app_user:
        return _error("Autentificare necesară.", 401)

    queryset = _visible_queryset(app_user, is_admin)
    queryset.filter(seen_at__isnull=True).update(seen_at=timezone.now())
    items = list(queryset)
    counts = {status: 0 for status in LeaveRequest.Status.values}
    for item in items:
        counts[item.status] = counts.get(item.status, 0) + 1
    return JsonResponse({
        "leave_requests": [_serialize(item, True) for item in items],
        "counts": {"total": len(items), **counts},
        "permissions": {"can_manage_all": is_admin},
    })


@csrf_exempt
@transaction.atomic
def leave_request_decision(request, request_id):
    if request.method != "POST":
        return _error("Metodă nepermisă.", 405)
    app_user, is_admin = _actor(request)
    if not is_admin and not app_user:
        return _error("Autentificare necesară.", 401)

    try:
        body = json.loads(request.body or "{}")
    except (TypeError, ValueError, UnicodeDecodeError):
        return _error("Corpul cererii nu este JSON valid.")
    action = str(body.get("action") or "").strip().lower()
    status_by_action = {
        "approve": LeaveRequest.Status.APPROVED,
        "approved": LeaveRequest.Status.APPROVED,
        "reject": LeaveRequest.Status.REJECTED,
        "rejected": LeaveRequest.Status.REJECTED,
    }
    target_status = status_by_action.get(action)
    if not target_status:
        return _error("Acțiunea trebuie să fie approve sau reject.")

    item = _base_queryset().select_for_update().filter(pk=request_id).first()
    if not item:
        return _error("Cererea de concediu nu există.", 404)
    supervisor_id = (item.team.supervisor_id or item.team.leader_id) if item.team_id else item.assigned_leader_id
    if not is_admin and supervisor_id != app_user.employee_id:
        return _error("Numai supervisorul echipei poate soluționa această cerere.", 403)
    if item.status != LeaveRequest.Status.PENDING:
        return _error("Cererea a fost deja soluționată.", 409)

    item.status = target_status
    item.reviewed_at = timezone.now()
    item.seen_at = item.seen_at or item.reviewed_at
    item.reviewed_by_app_user = app_user
    item.approved_at = item.reviewed_at if target_status == LeaveRequest.Status.APPROVED else None
    try:
        item.save()
    except ValidationError as exc:
        details = exc.message_dict if hasattr(exc, "message_dict") else {"non_field_errors": exc.messages}
        return _error("Cererea nu a putut fi soluționată.", 400, details)
    if target_status == LeaveRequest.Status.APPROVED:
        approver_name = app_user.employee.UserName if app_user and app_user.employee_id else "Administrator"
        send_leave_approval_email(item, approver_name)
    return JsonResponse({"leave_request": _serialize(item, False)})
