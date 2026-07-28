import json
from datetime import date

from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.utils.timezone import localdate
from django.views.decorators.csrf import csrf_exempt

from ToolApp.mobile_services import (
    build_inventory,
    build_leave_summary,
    build_salary_payments,
    build_team,
    calculate_payroll,
    first_payment_date,
    normalize_trade_code,
    previous_month,
    salary_period_is_eligible,
    seniority_months,
    serialize_leave_request,
)
from ToolApp.models import EmployeeSalaryProfile, LeaveRequest
from ToolApp.views import _find_user_by_pin, _log_pin_attempt, _pin_is_blocked


def _error(error_code, message, status):
    return JsonResponse({"success": False, "error_code": error_code, "error": message}, status=status)


def _json_body(request):
    try:
        value = json.loads(request.body or "{}")
    except (TypeError, ValueError, UnicodeDecodeError):
        return None
    return value if isinstance(value, dict) else None


def resolve_mobile_employee(request, data):
    pin = str(data.get("pin") or "").strip()
    device_key = str(data.get("device_key") or "").strip()
    if not device_key or len(device_key) > 64:
        return None, _error("INVALID_DEVICE_KEY", "device_key este obligatoriu și trebuie să aibă maximum 64 de caractere.", 400)
    blocked, retry_after = _pin_is_blocked(request, device_key=device_key, uid="MANUAL")
    if blocked:
        response = _error("PIN_TEMPORARILY_BLOCKED", "Prea multe încercări greșite. Încearcă din nou mai târziu.", 429)
        response["Retry-After"] = str(retry_after)
        return None, response
    if not pin:
        _log_pin_attempt(request, success=False, reason="missing_pin", device_key=device_key, uid="MANUAL")
        return None, _error("PIN_REQUIRED", "PIN-ul este obligatoriu.", 400)
    employee = _find_user_by_pin(pin)
    if not employee:
        _log_pin_attempt(request, success=False, reason="invalid_pin", device_key=device_key, uid="MANUAL")
        return None, _error("INVALID_PIN", "Nu există niciun angajat pentru PIN-ul introdus.", 404)
    _log_pin_attempt(request, success=True, reason="mobile_ok", device_key=device_key, uid="MANUAL")
    return employee, None


def _mobile_post(request):
    if request.method != "POST":
        return None, None, _error("METHOD_NOT_ALLOWED", "Este permis doar POST.", 405)
    data = _json_body(request)
    if data is None:
        return None, None, _error("INVALID_JSON", "Corpul cererii nu este JSON valid.", 400)
    employee, error = resolve_mobile_employee(request, data)
    return data, employee, error


@csrf_exempt
def employee_dashboard(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    today = localdate()
    profile = EmployeeSalaryProfile.objects.filter(employee=employee).first()
    salary_year, salary_month = previous_month(today.year, today.month)
    payroll = calculate_payroll(employee, profile, salary_year, salary_month)
    eligible = salary_period_is_eligible(employee.hire_date, salary_year, salary_month)
    salary_payments = build_salary_payments(profile, payroll, today.year, today.month) if eligible else []
    equipment, tools = build_inventory(employee)
    payload = {
        "success": True,
        "profile": {
            "display_name": employee.UserName,
            "role_code": normalize_trade_code(employee.trade),
            "role": employee.trade,
            "company": employee.Company,
            "hire_date": employee.hire_date.isoformat() if employee.hire_date else None,
            "seniority_months": seniority_months(employee.hire_date, today),
            "housing_location": employee.housing_location,
        },
        "payroll": payroll,
        "salary_payments": salary_payments,
        "leave_summary": build_leave_summary(employee, today),
        "equipment": equipment,
        "tools": tools,
        "team": build_team(employee),
    }
    if not eligible:
        first_date = first_payment_date(employee.hire_date)
        payload.update({
            "first_payment_date": first_date.isoformat() if first_date else None,
            "message_code": "first_salary_after_full_month",
        })
    return JsonResponse(payload)


@csrf_exempt
def leave_request_create(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    leave_type = str(data.get("leave_type") or "").strip()
    if leave_type not in LeaveRequest.LeaveType.values:
        return _error("INVALID_LEAVE_TYPE", "Tipul de concediu nu este valid.", 400)
    try:
        start_date = date.fromisoformat(str(data.get("start_date") or ""))
        end_date = date.fromisoformat(str(data.get("end_date") or ""))
    except ValueError:
        return _error("INVALID_DATE", "Datele trebuie trimise în format YYYY-MM-DD.", 400)
    item = LeaveRequest(
        employee=employee,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
    )
    try:
        item.save()
    except ValidationError as exc:
        message = "; ".join(exc.messages)
        code = "OVERLAPPING_LEAVE_REQUEST" if "suprapune" in message else "INVALID_DATE_RANGE"
        return _error(code, message, 400)
    return JsonResponse({"success": True, "leave_request": serialize_leave_request(item)}, status=201)


@csrf_exempt
def leave_request_list(request):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    items = LeaveRequest.objects.filter(employee=employee)
    return JsonResponse({
        "success": True,
        "leave_requests": [serialize_leave_request(item) for item in items],
    })


@csrf_exempt
def leave_request_cancel(request, request_id):
    data, employee, error = _mobile_post(request)
    if error:
        return error
    item = LeaveRequest.objects.filter(pk=request_id, employee=employee).first()
    if not item:
        return _error("LEAVE_REQUEST_NOT_FOUND", "Cererea de concediu nu există.", 404)
    if item.status != LeaveRequest.Status.PENDING:
        return _error("LEAVE_REQUEST_NOT_CANCELLABLE", "Doar cererile în așteptare pot fi anulate.", 409)
    item.status = LeaveRequest.Status.CANCELLED
    item.save(update_fields=("status",))
    return JsonResponse({"success": True, "leave_request": serialize_leave_request(item)})

