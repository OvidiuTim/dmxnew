import re
import unicodedata

from django.db import transaction
from django.contrib.auth.hashers import make_password

from ToolApp.models import AppUser, Users


def _username_part(value):
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(character for character in text if unicodedata.category(character) != "Mn")
    return re.sub(r"[^a-zA-Z0-9]+", ".", text).strip(".").lower() or "angajat"


def _unique_username(employee):
    name_parts = [_username_part(part) for part in str(employee.UserName or "").split() if part.strip()]
    base = ".".join(name_parts[:2]) or f"angajat.{employee.pk}"
    candidate = base
    suffix = 2
    while AppUser.objects.filter(username__iexact=candidate).exclude(employee=employee).exists():
        candidate = f"{base}.{suffix}"
        suffix += 1
    return candidate


def employee_can_have_app_account(employee):
    return bool(
        employee
        and employee.pk
        and employee.person_type == Users.PersonType.EMPLOYEE
        and employee.active
        and employee.employment_status == Users.EmploymentStatus.ACTIVE
        and str(employee.UserSerie or "").strip()
    )


@transaction.atomic
def sync_employee_app_user(employee):
    """Create/update the single AppUser owned by an employee.

    The login secret is only persisted through Django's password hasher.  The
    existing employee PIN remains the source of truth for the current login flow.
    """
    existing = AppUser.objects.select_for_update().filter(employee=employee).first()
    should_be_active = employee_can_have_app_account(employee)
    if not should_be_active:
        if existing and existing.is_active:
            existing.is_active = False
            existing.save(update_fields=("is_active", "updated_at"))
        return existing, False

    created = existing is None
    app_user = existing or AppUser(
        employee=employee,
        username=_unique_username(employee),
        login_redirect_path="/pontaj",
    )
    changed_fields = []
    if not app_user.is_active:
        app_user.is_active = True
        changed_fields.append("is_active")
    raw_pin = str(employee.UserPin or "").strip()
    if raw_pin and not app_user.check_pin(raw_pin):
        app_user.set_pin(employee.UserPin)
        changed_fields.append("pin_hash")
    elif created and not raw_pin:
        app_user.pin_hash = make_password(None)
        changed_fields.append("pin_hash")
    if created:
        app_user.save()
    elif changed_fields:
        app_user.save(update_fields=tuple(changed_fields + ["updated_at"]))
    return app_user, created


def sync_all_employee_app_users(queryset=None):
    queryset = queryset if queryset is not None else Users.objects.all()
    summary = {"created": 0, "updated": 0, "deactivated": 0, "skipped": 0}
    for employee in queryset.iterator():
        before = AppUser.objects.filter(employee=employee).values("is_active", "pin_hash").first()
        app_user, created = sync_employee_app_user(employee)
        if created:
            summary["created"] += 1
        elif app_user is None:
            summary["skipped"] += 1
        elif before and before["is_active"] and not app_user.is_active:
            summary["deactivated"] += 1
        elif before and (not before["is_active"] or before["pin_hash"] != app_user.pin_hash):
            summary["updated"] += 1
        else:
            summary["skipped"] += 1
    return summary
