import json
from datetime import date

from django.core.management.base import BaseCommand, CommandError

from ToolApp.team_attendance_notifications import create_team_attendance_alerts


class Command(BaseCommand):
    help = "Trimite la 07:40 alertele grupate pentru membrii echipelor fără check-in."

    def add_arguments(self, parser):
        parser.add_argument("--date", help="Data YYYY-MM-DD; implicit astăzi.")
        parser.add_argument("--no-email", action="store_true")
        parser.add_argument("--no-push", action="store_true")

    def handle(self, *args, **options):
        try:
            work_date = date.fromisoformat(options["date"]) if options.get("date") else None
        except ValueError as exc:
            raise CommandError("--date trebuie să fie în format YYYY-MM-DD.") from exc
        summary = create_team_attendance_alerts(
            work_date=work_date,
            send_email=not options["no_email"],
            send_push=not options["no_push"],
        )
        self.stdout.write(json.dumps(summary, ensure_ascii=False, sort_keys=True))
