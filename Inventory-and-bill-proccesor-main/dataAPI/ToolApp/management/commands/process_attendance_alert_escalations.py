import json

from django.core.management.base import BaseCommand

from ToolApp.attendance_alert_escalation import process_due_attendance_alerts


class Command(BaseCommand):
    help = "Procesează idempotent alertele de pontaj 07:40, Nivel 1 și Nivel 2."

    def add_arguments(self, parser):
        parser.add_argument("--no-email", action="store_true")
        parser.add_argument("--no-push", action="store_true")

    def handle(self, *args, **options):
        result = process_due_attendance_alerts(
            send_email=not options["no_email"],
            send_push=not options["no_push"],
        )
        self.stdout.write(json.dumps(result, ensure_ascii=False, sort_keys=True))
