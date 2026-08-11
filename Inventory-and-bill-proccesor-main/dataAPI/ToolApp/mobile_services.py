import calendar
import unicodedata
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP

from django.db.models import Q
from django.utils.text import slugify

from ToolApp.models import AttendanceSession, EmployeeTeam, Histories, LeaveDay, LeaveRequest, Tools


MONEY_PLACES = Decimal("0.01")
LEAVE_ACCRUAL_PER_MONTH = Decimal("1.75")
SALARY_ADVANCE = "salary_advance"
SALARY_REMAINDER = "salary_remainder"
FOOD_MONEY = "food_money"

TRADE_CODE_MAP = {
    "instalator": "installer",
    "installer": "installer",
    "electrician": "electrician",
    "dulgher": "carpenter",
    "carpenter": "carpenter",
    "sef-de-echipa": "team_leader",
    "sef-echipa": "team_leader",
    "team-leader": "team_leader",
    "team_leader": "team_leader",
    "sef-santier": "site_manager",
    "sef-de-santier": "site_manager",
    "site-manager": "site_manager",
    "site_manager": "site_manager",
}


def money(value):
    return Decimal(value or 0).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def money_string(value):
    return f"{money(value):.2f}"


def normalize_trade_code(raw_trade):
    unicode_normalized = unicodedata.normalize("NFKD", str(raw_trade or "").strip())
    without_combining_marks = "".join(
        character for character in unicode_normalized if not unicodedata.combining(character)
    )
    normalized = slugify(without_combining_marks)
    return TRADE_CODE_MAP.get(normalized, "worker")


def month_bounds(year, month):
    return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])


def previous_month(year, month):
    return (year - 1, 12) if month == 1 else (year, month - 1)


def next_month(year, month):
    return (year + 1, 1) if month == 12 else (year, month + 1)


def count_salary_days_in_range(start_date, end_date):
    if not start_date or not end_date or end_date < start_date:
        return 0
    count = 0
    current = start_date
    while current <= end_date:
        if current.isoweekday() <= 6:
            count += 1
        current += timedelta(days=1)
    return count


def count_required_work_days(year, month):
    start, end = month_bounds(year, month)
    return count_salary_days_in_range(start, end)


def first_full_salary_month(hire_date):
    if not hire_date:
        return None
    if hire_date.day == 1:
        return date(hire_date.year, hire_date.month, 1)
    year, month = next_month(hire_date.year, hire_date.month)
    return date(year, month, 1)


def first_payment_date(hire_date):
    first_period = first_full_salary_month(hire_date)
    if not first_period:
        return None
    year, month = next_month(first_period.year, first_period.month)
    return date(year, month, 5)


def salary_period_is_eligible(hire_date, year, month):
    if not hire_date:
        return True
    return date(year, month, 1) >= first_full_salary_month(hire_date)


def dashboard_salary_period(today, hire_date):
    previous_year, previous_month_number = previous_month(today.year, today.month)
    regular_period = date(previous_year, previous_month_number, 1)
    first_period = first_full_salary_month(hire_date)
    selected_period = max(regular_period, first_period) if first_period else regular_period
    return selected_period.year, selected_period.month


def salary_period_payment_month(year, month):
    return next_month(year, month)


def _salary_dates(start_date, end_date, values):
    return {value for value in values if start_date <= value <= end_date and value.isoweekday() <= 6}


def _request_dates(queryset, start_date=None, end_date=None):
    dates = set()
    for request in queryset:
        current = request.start_date if start_date is None else max(request.start_date, start_date)
        last = request.end_date if end_date is None else min(request.end_date, end_date)
        while current <= last:
            if current.isoweekday() <= 6:
                dates.add(current)
            current += timedelta(days=1)
    return dates


def calculate_payroll(employee, profile, year, month):
    start_date, end_date = month_bounds(year, month)
    required_days = count_required_work_days(year, month)

    if not salary_period_is_eligible(employee.hire_date, year, month):
        return {
            "salary_year": year,
            "salary_month": month,
            "net_salary_eur": money_string(profile.net_salary_eur if profile else 0),
            "net_salary_ron": money_string(profile.net_salary_ron if profile else 0),
            "required_days": required_days,
            "worked_days": 0,
            "paid_leave_days": 0,
            "unpaid_leave_days": 0,
            "unexcused_absence_days": 0,
            "payable_days": 0,
            "daily_rate": "0.00",
            "salary_due": "0.00",
            "absence_deduction": "0.00",
            "advance": "0.00",
            "remainder": "0.00",
            "food_money": "0.00",
            "grand_total": "0.00",
        }

    attendance_dates = _salary_dates(
        start_date,
        end_date,
        AttendanceSession.objects.filter(
            user_fk=employee,
            work_date__range=(start_date, end_date),
            out_time__isnull=False,
        ).values_list("work_date", flat=True).distinct(),
    )
    paid_leave_dates = _request_dates(
        LeaveRequest.objects.filter(
            employee=employee,
            leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
            status=LeaveRequest.Status.APPROVED,
            start_date__lte=end_date,
            end_date__gte=start_date,
        ),
        start_date,
        end_date,
    )
    paid_leave_dates.update(_salary_dates(
        start_date,
        end_date,
        LeaveDay.objects.filter(
            user_fk=employee,
            work_date__range=(start_date, end_date),
            reason=LeaveDay.Reason.CO,
        ).values_list("work_date", flat=True),
    ))
    unpaid_leave_dates = _request_dates(
        LeaveRequest.objects.filter(
            employee=employee,
            leave_type=LeaveRequest.LeaveType.UNPAID_LEAVE,
            status=LeaveRequest.Status.APPROVED,
            start_date__lte=end_date,
            end_date__gte=start_date,
        ),
        start_date,
        end_date,
    )
    unpaid_leave_dates.update(_salary_dates(
        start_date,
        end_date,
        LeaveDay.objects.filter(
            user_fk=employee,
            work_date__range=(start_date, end_date),
            reason=LeaveDay.Reason.UNPAID,
        ).values_list("work_date", flat=True),
    ))
    unexcused_dates = _salary_dates(
        start_date,
        end_date,
        LeaveDay.objects.filter(
            user_fk=employee,
            work_date__range=(start_date, end_date),
            reason=LeaveDay.Reason.UNEXCUSED,
        ).values_list("work_date", flat=True),
    )

    non_payable_dates = unpaid_leave_dates | unexcused_dates
    payable_dates = (attendance_dates | paid_leave_dates) - non_payable_dates
    payable_days = len(payable_dates)
    net_salary = Decimal(profile.net_salary_ron if profile else 0)
    raw_daily_rate = net_salary / Decimal(required_days) if required_days else Decimal("0")
    salary_due = money(net_salary * Decimal(payable_days) / Decimal(required_days)) if required_days else Decimal("0.00")
    configured_advance = Decimal(profile.salary_advance_ron if profile else 0)
    advance = money(min(configured_advance, salary_due))
    remainder = money(max(salary_due - advance, Decimal("0.00")))
    food_money = money(
        profile.food_money_ron
        if payable_days > 0 and profile and profile.food_money_enabled
        else 0
    )
    grand_total = money(salary_due + food_money)

    return {
        "salary_year": year,
        "salary_month": month,
        "net_salary_eur": money_string(profile.net_salary_eur if profile else 0),
        "net_salary_ron": money_string(net_salary),
        "required_days": required_days,
        "worked_days": len(attendance_dates),
        "paid_leave_days": len(paid_leave_dates),
        "unpaid_leave_days": len(unpaid_leave_dates),
        "unexcused_absence_days": len(unexcused_dates),
        "payable_days": payable_days,
        "daily_rate": money_string(raw_daily_rate),
        "salary_due": money_string(salary_due),
        "absence_deduction": money_string(raw_daily_rate * Decimal(len(unexcused_dates))),
        "advance": money_string(advance),
        "remainder": money_string(remainder),
        "food_money": money_string(food_money),
        "grand_total": money_string(grand_total),
    }


def build_salary_payments(profile, payroll, payment_year, payment_month):
    payments = [
        {
            "payment_date": date(payment_year, payment_month, 5).isoformat(),
            "type": SALARY_ADVANCE,
            "amount": payroll["advance"],
        },
        {
            "payment_date": date(payment_year, payment_month, 20).isoformat(),
            "type": SALARY_REMAINDER,
            "amount": payroll["remainder"],
        },
    ]
    payments.append({
        "payment_date": date(payment_year, payment_month, 20).isoformat(),
        "type": FOOD_MONEY,
        "amount": payroll["food_money"],
    })
    return payments


def completed_full_months(hire_date, as_of_date):
    if not hire_date or as_of_date < hire_date:
        return 0
    first_month = first_full_salary_month(hire_date)
    current_month_end = month_bounds(as_of_date.year, as_of_date.month)[1]
    if as_of_date >= current_month_end:
        last_year, last_month = as_of_date.year, as_of_date.month
    else:
        last_year, last_month = previous_month(as_of_date.year, as_of_date.month)
    last_month_start = date(last_year, last_month, 1)
    if last_month_start < first_month:
        return 0
    return (last_year - first_month.year) * 12 + last_month - first_month.month + 1


def accrued_leave_days(employee, as_of_date):
    return Decimal(completed_full_months(employee.hire_date, as_of_date)) * LEAVE_ACCRUAL_PER_MONTH


def approved_paid_leave_dates(employee, exclude_request_id=None):
    queryset = LeaveRequest.objects.filter(
        employee=employee,
        leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
        status=LeaveRequest.Status.APPROVED,
    )
    if exclude_request_id:
        queryset = queryset.exclude(pk=exclude_request_id)
    return _request_dates(queryset)


def calculate_available_leave_days(employee, as_of_date, exclude_request_id=None):
    remaining = accrued_leave_days(employee, as_of_date) - Decimal(
        len(approved_paid_leave_dates(employee, exclude_request_id=exclude_request_id))
    )
    return max(0, int(max(remaining, Decimal("0")).to_integral_value(rounding=ROUND_FLOOR)))


def build_leave_summary(employee, as_of_date):
    approved_dates = approved_paid_leave_dates(employee)
    pending_dates = _request_dates(LeaveRequest.objects.filter(
        employee=employee,
        leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
        status=LeaveRequest.Status.PENDING,
    ))
    accrued = accrued_leave_days(employee, as_of_date)
    return {
        "accrued_days": f"{accrued:.2f}",
        "available_days": calculate_available_leave_days(employee, as_of_date),
        "pending_days": len(pending_dates),
        "used_days": len(approved_dates),
    }


def _stable_name_code(tool):
    raw = tool.ToolName or tool.Category or "tool"
    normalized = slugify(raw)
    if tool.IsSSM:
        equipment_codes = {
            "helmet": ("casca", "helmet"),
            "boots": ("bocanc", "gheata", "boot"),
            "vest": ("vesta", "vest"),
            "harness": ("ham", "harness"),
            "gloves": ("manus", "glove"),
        }
        for code, keywords in equipment_codes.items():
            if any(keyword in normalized for keyword in keywords):
                return code
    tool_codes = {
        "drill": ("bormasina", "masina-de-gaurit", "drill"),
        "angle_grinder": ("flex", "polizor-unghiular", "angle-grinder", "grinder"),
        "multimeter": ("multimetru", "multimeter"),
    }
    for code, keywords in tool_codes.items():
        if any(keyword in normalized for keyword in keywords):
            return code
    return "equipment" if tool.IsSSM else "tool"


def normalize_tool_status(tool):
    if tool.IsLost:
        return "lost"
    if tool.Status == Tools.ToolStatus.NEFUNCTIONALA:
        return "damaged"
    return "in_use"


def build_inventory(employee):
    states = defaultdict(lambda: {"quantity": 0, "assigned_date": None})
    movements = Histories.objects.filter(
        user_fk=employee,
        tool_fk__isnull=False,
    ).select_related("tool_fk").order_by("tool_fk_id", "timestamp", "HistoryId")
    tools_by_id = {}
    for movement in movements:
        tool = movement.tool_fk
        tools_by_id[tool.ToolId] = tool
        state = states[tool.ToolId]
        quantity = max(0, int(movement.quantity or 0))
        if movement.direction == Histories.Movement.OUT:
            if state["quantity"] <= 0:
                state["assigned_date"] = movement.timestamp.date()
            state["quantity"] += quantity
        elif movement.direction == Histories.Movement.IN:
            state["quantity"] = max(0, state["quantity"] - quantity)
            if state["quantity"] == 0:
                state["assigned_date"] = None

    rows = []
    for tool_id, state in states.items():
        if state["quantity"] <= 0:
            continue
        tool = tools_by_id[tool_id]
        rows.append({
            "kind": "equipment" if tool.IsSSM else "tool",
            "name_code": _stable_name_code(tool),
            "display_name": tool.ToolName,
            "brand": tool.Brand,
            "serial_number": tool.SerialNumber or tool.ToolSerie,
            "status": normalize_tool_status(tool),
            "quantity": state["quantity"],
            "size": employee.equipment_size if tool.IsSSM else None,
            "assigned_date": state["assigned_date"].isoformat() if state["assigned_date"] else None,
        })
    rows.sort(key=lambda row: (row["kind"], (row["display_name"] or "").casefold(), row["serial_number"] or ""))
    return (
        [{key: value for key, value in row.items() if key != "kind"} for row in rows if row["kind"] == "equipment"],
        [{key: value for key, value in row.items() if key != "kind"} for row in rows if row["kind"] == "tool"],
    )


def _team_member_payload(employee, leader_id, current_id):
    return {
        "employee_id": employee.UserId,
        "display_name": employee.UserName,
        "trade_code": normalize_trade_code(employee.trade),
        "trade": employee.trade,
        "is_team_leader": employee.UserId == leader_id,
        "is_current_user": employee.UserId == current_id,
    }


def build_team(employee):
    team = EmployeeTeam.objects.filter(active=True).filter(
        Q(leader=employee) | Q(memberships__employee=employee, memberships__active=True)
    ).select_related("leader").distinct().first()
    if not team:
        return None
    members = [
        membership.employee
        for membership in team.memberships.filter(active=True).select_related("employee")
        if membership.employee_id != team.leader_id
    ]
    members.sort(key=lambda item: ((item.UserName or "").casefold(), item.UserId))
    current_member = next((item for item in members if item.UserId == employee.UserId), None)
    ordered_members = [item for item in members if item.UserId != employee.UserId]
    if current_member:
        ordered_members.append(current_member)
    return {
        "name": team.name,
        "leader": _team_member_payload(team.leader, team.leader_id, employee.UserId),
        "members": [_team_member_payload(item, team.leader_id, employee.UserId) for item in ordered_members],
    }


def seniority_months(hire_date, today):
    if not hire_date or hire_date > today:
        return 0
    months = (today.year - hire_date.year) * 12 + today.month - hire_date.month
    if today.day < hire_date.day:
        months -= 1
    return max(0, months)


def serialize_leave_request(item):
    return {
        "id": item.pk,
        "leave_type": item.leave_type,
        "status": item.status,
        "start_date": item.start_date.isoformat(),
        "end_date": item.end_date.isoformat(),
        "leave_days": count_salary_days_in_range(item.start_date, item.end_date),
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "approved_at": item.approved_at.isoformat() if item.approved_at else None,
    }
