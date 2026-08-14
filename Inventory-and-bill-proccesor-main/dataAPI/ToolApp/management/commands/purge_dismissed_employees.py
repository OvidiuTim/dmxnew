from datetime import date

from django.core.management.base import BaseCommand

from ToolApp.employee_retention import purge_expired_dismissed_employees, retention_cutoff


class Command(BaseCommand):
    help = "Șterge angajații marcați Demis de cel puțin doi ani și toate datele personale asociate."

    def add_arguments(self, parser):
        parser.add_argument("--date", help="Data de referință YYYY-MM-DD. Implicit: astăzi.")
        parser.add_argument("--dry-run", action="store_true", help="Afișează angajații fără a-i șterge.")

    def handle(self, *args, **options):
        reference_date = date.fromisoformat(options["date"]) if options.get("date") else None
        employees = purge_expired_dismissed_employees(
            reference_date=reference_date,
            dry_run=options["dry_run"],
        )
        self.stdout.write(f"Prag retenție: {retention_cutoff(reference_date).isoformat()}")
        for employee in employees:
            self.stdout.write(f"- {employee.UserName} | {employee.UserSerie} | {employee.dismissed_at}")
        action = "identificați" if options["dry_run"] else "șterși"
        self.stdout.write(self.style.SUCCESS(f"Angajați {action}: {len(employees)}"))
