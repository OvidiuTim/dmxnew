from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from ToolApp.app_accounts import sync_employee_app_user
from ToolApp.models import (
    AppUser,
    LeaveRequest,
    PortalTeamTransferRequest,
    TeamPortalNotification,
    Users,
)


@receiver(post_save, sender=Users, dispatch_uid="sync_employee_app_user")
def ensure_employee_app_user(sender, instance, raw=False, **kwargs):
    if raw:
        return
    employee_id = instance.pk

    def sync_after_commit():
        employee = Users.objects.filter(pk=employee_id).first()
        if employee:
            sync_employee_app_user(employee)

    transaction.on_commit(sync_after_commit)


def _portal_account(employee_id):
    return AppUser.objects.filter(employee_id=employee_id, is_active=True).first()


@receiver(post_save, sender=LeaveRequest, dispatch_uid="notify_portal_leave_request")
def notify_portal_leave_request(sender, instance, raw=False, **kwargs):
    if raw:
        return
    if instance.status == LeaveRequest.Status.PENDING:
        supervisor = instance.team.effective_supervisor if instance.team_id else instance.assigned_leader
        recipient = _portal_account(supervisor.pk) if supervisor else None
        requester = _portal_account(instance.employee_id)
        if recipient and (not requester or requester.pk != recipient.pk):
            TeamPortalNotification.objects.get_or_create(
                dedupe_key=f"leave_approval:{instance.pk}:{recipient.pk}:approval",
                defaults={
                    "recipient": recipient,
                    "kind": TeamPortalNotification.Kind.LEAVE_APPROVAL,
                    "leave_request": instance,
                },
            )
        return
    if instance.status in {LeaveRequest.Status.APPROVED, LeaveRequest.Status.REJECTED}:
        recipient = _portal_account(instance.employee_id)
        if recipient:
            TeamPortalNotification.objects.get_or_create(
                dedupe_key=f"leave_result:{instance.pk}:{recipient.pk}:{instance.status}",
                defaults={
                    "recipient": recipient,
                    "kind": TeamPortalNotification.Kind.LEAVE_RESULT,
                    "leave_request": instance,
                },
            )


@receiver(post_save, sender=PortalTeamTransferRequest, dispatch_uid="notify_portal_transfer_request")
def notify_portal_transfer_request(sender, instance, raw=False, **kwargs):
    if raw:
        return
    if instance.status == PortalTeamTransferRequest.Status.PENDING:
        stage = ""
        supervisor = None
        if instance.source_team_id and instance.source_approval == instance.ApprovalStatus.PENDING:
            stage, supervisor = "source", instance.source_team.effective_supervisor
        elif (
            instance.source_approval in {instance.ApprovalStatus.APPROVED, instance.ApprovalStatus.NOT_REQUIRED}
            and instance.destination_approval == instance.ApprovalStatus.PENDING
        ):
            stage, supervisor = "destination", instance.destination_team.effective_supervisor
        recipient = _portal_account(supervisor.pk) if supervisor else None
        if recipient and recipient.pk != instance.requested_by_id:
            TeamPortalNotification.objects.get_or_create(
                dedupe_key=f"transfer_approval:{instance.pk}:{recipient.pk}:{stage}",
                defaults={
                    "recipient": recipient,
                    "kind": TeamPortalNotification.Kind.TRANSFER_APPROVAL,
                    "transfer_request": instance,
                },
            )
        return
    if instance.status in {instance.Status.APPROVED, instance.Status.REJECTED}:
        TeamPortalNotification.objects.get_or_create(
            dedupe_key=f"transfer_result:{instance.pk}:{instance.requested_by_id}:{instance.status}",
            defaults={
                "recipient": instance.requested_by,
                "kind": TeamPortalNotification.Kind.TRANSFER_RESULT,
                "transfer_request": instance,
            },
        )
