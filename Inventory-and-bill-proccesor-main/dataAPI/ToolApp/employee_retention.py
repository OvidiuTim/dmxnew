import logging
from datetime import date

from django.db import transaction
from django.db.models import Q
from django.utils.timezone import localdate

from ToolApp.models import (
    AttendanceSession,
    DailyPay,
    EmployeeTeam,
    Histories,
    LeaveDay,
    PresenceEvent,
    TemporaryWorkerRequest,
    Tools,
    Users,
)


logger = logging.getLogger(__name__)


def retention_cutoff(reference_date=None):
    today = reference_date or localdate()
    try:
        return today.replace(year=today.year - 2)
    except ValueError:
        return date(today.year - 2, 2, 28)


def dismissed_employees_due_for_deletion(reference_date=None):
    return Users.objects.filter(
        employment_status=Users.EmploymentStatus.DISMISSED,
        dismissed_at__isnull=False,
        dismissed_at__lte=retention_cutoff(reference_date),
    ).order_by("dismissed_at", "UserId")


@transaction.atomic
def purge_dismissed_employee(employee):
    employee = Users.objects.select_for_update().get(pk=employee.pk)
    if employee.employment_status != Users.EmploymentStatus.DISMISSED:
        return False

    for document in employee.documents.all():
        if document.file:
            document.file.delete(save=False)

    TemporaryWorkerRequest.objects.filter(
        Q(employee=employee)
        | Q(source_team__leader=employee)
        | Q(requester_team__leader=employee)
    ).delete()
    EmployeeTeam.objects.filter(leader=employee).delete()
    Histories.objects.filter(user_fk=employee).update(user_fk=None, User="Angajat șters")
    Histories.objects.filter(issued_by=employee).update(issued_by=None)
    Tools.objects.filter(AssignedTo=employee).update(AssignedTo=None, User=None)
    AttendanceSession.objects.filter(user_fk=employee).delete()
    PresenceEvent.objects.filter(user_fk=employee).delete()
    DailyPay.objects.filter(user_fk=employee).delete()
    LeaveDay.objects.filter(user_fk=employee).delete()
    employee.delete()
    return True


def purge_expired_dismissed_employees(reference_date=None, dry_run=False):
    candidates = list(dismissed_employees_due_for_deletion(reference_date))
    if dry_run:
        return candidates
    purged = []
    for employee in candidates:
        try:
            if purge_dismissed_employee(employee):
                purged.append(employee)
        except Exception:
            logger.exception("Ștergerea automată a angajatului demis #%s a eșuat.", employee.pk)
    return purged
