"""Read-only cost attribution. Never rewrites attendance or payroll snapshots."""
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Case, Count, IntegerField, OuterRef, Q, Subquery, Sum, When

from ToolApp.models import AttendanceSession, DailyPay, SiteAttendancePoint, SiteExpense
from ToolApp.worksites import match_worksite

ZERO = Decimal("0.00")


def money(value):
    return str(Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def bucket():
    return {"seconds": 0, "labor_cost": ZERO, "expense_cost": ZERO, "open_sessions": 0,
            "estimated_seconds": 0, "missing_rate_seconds": 0, "employees": {}, "categories": {}, "points": {}}


def finish(value):
    result = {key: val for key, val in value.items() if key not in ("employees", "categories", "points")}
    result.update(hours=money(Decimal(value["seconds"]) / 3600),
                  labor_cost=money(value["labor_cost"]), expense_cost=money(value["expense_cost"]),
                  total_cost=money(value["labor_cost"] + value["expense_cost"]),
                  employee_count=len(value["employees"]))
    result["employees"] = [
        {**row, "hours": money(Decimal(row["seconds"]) / 3600), "cost": money(row["cost"])}
        for row in sorted(value["employees"].values(), key=lambda row: (-row["cost"], row["name"]))
    ]
    result["categories"] = [{"category": key, "amount": money(amount)} for key, amount in value["categories"].items()]
    result["points"] = [
        {**row, "hours": money(Decimal(row["seconds"]) / 3600), "cost": money(row["cost"])}
        for row in sorted(value["points"].values(), key=lambda row: row["name"])
    ]
    return result


def cost_report(start=None, end=None):
    """Aggregate at employee/day/point grain; query count is independent of headcount.

    Split rounded daily wage across points using cumulative rounding. This preserves
    cents across sites. Leave, bonuses and non-attendance benefits are not labor here.
    Lifetime totals are returned separately so a month filter never distorts budgets.
    """
    mapping = dict(SiteAttendancePoint.objects.values_list("name", "site_id"))
    period, lifetime = defaultdict(bucket), defaultdict(bucket)
    all_period = bucket()
    rate = DailyPay.objects.filter(user_fk_id=OuterRef("user_fk_id"), work_date=OuterRef("work_date")).values("hourly_rate_snapshot")[:1]
    rows = (AttendanceSession.objects.order_by("work_date", "user_fk_id", "worksite")
            .values("work_date", "user_fk_id", "user_fk__UserName", "user_fk__UserSerie", "user_fk__Company", "user_fk__hourly_rate", "worksite")
            .annotate(seconds=Sum(Case(When(out_time__isnull=False, duration_seconds__gt=0, then="duration_seconds"), default=0, output_field=IntegerField())),
                      open_count=Count("id", filter=Q(out_time__isnull=True)), snapshot_rate=Subquery(rate)))
    previous_key, running_exact, running_rounded = None, ZERO, ZERO
    for row in rows.iterator(chunk_size=2000):
        key = (row["user_fk_id"], row["work_date"])
        if key != previous_key:
            previous_key, running_exact, running_rounded = key, ZERO, ZERO
        seconds = row["seconds"] or 0
        estimated = row["snapshot_rate"] is None
        hourly_rate = row["user_fk__hourly_rate"] if estimated else row["snapshot_rate"]
        hourly_rate = max(ZERO, hourly_rate or ZERO)
        running_exact += Decimal(seconds) * hourly_rate / 3600
        new_rounded = Decimal(money(running_exact))
        cost = new_rounded - running_rounded
        running_rounded = new_rounded
        point = match_worksite(row["worksite"]) or ((row["worksite"] or "").strip() or "Fără punct de pontaj")
        site_id = mapping.get(point, 0)
        targets = [lifetime[site_id]]
        if (start is None or row["work_date"] >= start) and (end is None or row["work_date"] <= end):
            targets.extend([period[site_id], all_period])
        for target in targets:
            target["seconds"] += seconds
            target["labor_cost"] += cost
            target["open_sessions"] += row["open_count"]
            target["estimated_seconds"] += seconds if estimated else 0
            target["missing_rate_seconds"] += seconds if not hourly_rate else 0
            employee = target["employees"].setdefault(row["user_fk_id"], {
                "id": row["user_fk_id"], "name": row["user_fk__UserName"], "serie": row["user_fk__UserSerie"],
                "company": row["user_fk__Company"] or "", "seconds": 0, "cost": ZERO,
                "estimated_seconds": 0, "missing_rate_seconds": 0, "open_sessions": 0})
            employee["seconds"] += seconds
            employee["cost"] += cost
            employee["estimated_seconds"] += seconds if estimated else 0
            employee["missing_rate_seconds"] += seconds if not hourly_rate else 0
            employee["open_sessions"] += row["open_count"]
            point_row = target["points"].setdefault(point, {"name": point, "seconds": 0, "cost": ZERO, "open_sessions": 0})
            point_row["seconds"] += seconds
            point_row["cost"] += cost
            point_row["open_sessions"] += row["open_count"]
    expenses = SiteExpense.objects.filter(cancelled_at__isnull=True).order_by().values("site_id", "date", "category").annotate(total=Sum("amount"))
    for row in expenses.iterator(chunk_size=2000):
        targets = [lifetime[row["site_id"]]]
        if (start is None or row["date"] >= start) and (end is None or row["date"] <= end):
            targets.extend([period[row["site_id"]], all_period])
        for target in targets:
            target["expense_cost"] += row["total"]
            target["categories"][row["category"]] = target["categories"].get(row["category"], ZERO) + row["total"]
    return ({key: finish(value) for key, value in period.items()},
            {key: finish(value) for key, value in lifetime.items()}, finish(all_period))
