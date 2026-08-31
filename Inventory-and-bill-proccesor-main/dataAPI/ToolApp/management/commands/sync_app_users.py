from django.core.management.base import BaseCommand

from ToolApp.app_accounts import sync_all_employee_app_users


class Command(BaseCommand):
    help = "Creează/sincronizează automat conturile AppUser pentru toți angajații existenți."

    def handle(self, *args, **options):
        summary = sync_all_employee_app_users()
        self.stdout.write(self.style.SUCCESS(
            "Sincronizare AppUser finalizată: "
            f"create={summary['created']}, actualizate/reactivate={summary['updated']}, "
            f"dezactivate={summary['deactivated']}, neschimbate={summary['skipped']}."
        ))
