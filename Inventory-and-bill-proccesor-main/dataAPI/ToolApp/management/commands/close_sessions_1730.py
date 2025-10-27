# ToolApp/management/commands/close_sessions_1730.py
from django.core.management.base import BaseCommand
from django.utils.timezone import localdate
from ToolApp.views import close_open_sessions_for_day_at_1730

class Command(BaseCommand):
    help = "Închide sesiunile rămase deschise azi la ora 17:30 (folosită din cron la 23:30)."

    def handle(self, *args, **options):
        today = localdate()
        closed = close_open_sessions_for_day_at_1730(today)
        self.stdout.write(self.style.SUCCESS(f"[close_sessions_1730] {today}: închise {closed} sesiuni"))
