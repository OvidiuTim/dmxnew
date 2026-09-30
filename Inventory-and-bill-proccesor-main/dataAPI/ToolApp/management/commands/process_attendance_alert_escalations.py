import json
import fcntl
import os
import tempfile
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone

from ToolApp.attendance_alert_escalation import (
    process_due_attendance_alerts, run_attendance_maintenance, send_late_checkin_report,
)


class Command(BaseCommand):
    help = "Procesează idempotent alertele de pontaj 07:30, Nivel 1 și Nivel 2."

    def add_arguments(self, parser):
        parser.add_argument("--no-email", action="store_true")
        parser.add_argument("--no-push", action="store_true")
        parser.add_argument("--maintenance", action="store_true", help="Întreținere periodică în afara cererilor web.")

    def handle(self, *args, **options):
        # The timer and existing cron entries use the same lock. No overlapping
        # jobs, duplicate sends or growing queue when a provider is slow.
        lock_path = Path(tempfile.gettempdir()) / f"dmx-attendance-alerts-{os.getuid()}.lock"
        with lock_path.open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                self.stdout.write("Întreținerea pontajului rulează deja; omit această execuție.")
                return
            result = self.run_job(options)
        self.stdout.write(json.dumps(result, ensure_ascii=False, sort_keys=True))

    def run_job(self, options):
        kwargs = {"send_email": not options["no_email"], "send_push": not options["no_push"]}
        if not options["maintenance"]:
            return process_due_attendance_alerts(**kwargs)
        now = timezone.localtime()
        run_attendance_maintenance(now=now, force=True, **kwargs)
        result = {"date": now.date().isoformat(), "maintenance": True}
        if (now.hour, now.minute) >= (18, 0):
            result["late_checkins"] = send_late_checkin_report(now=now, send_email=kwargs["send_email"])
        return result
