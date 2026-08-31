from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from ToolApp.app_accounts import sync_employee_app_user
from ToolApp.models import Users


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
