from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ToolApp.home_ticket_import import HomeTicketImportError, import_home_ticket_benefits
from ToolApp.models import Users


DEFAULT_FILE = Path(settings.BASE_DIR) / "ToolApp" / "data" / "bonus_avion_excel_general.xlsx"


class Command(BaseCommand):
    help = (
        "Verifică sau importă datele pentru Ajutor bilet acasă. Implicit este dry-run; "
        "--apply scrie doar cele trei câmpuri permise."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "file",
            nargs="?",
            default=str(DEFAULT_FILE),
            help="Fișierul XLSX; implicit folosește copia versionată pentru migrarea one-shot.",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Aplică actualizările; fără acest flag comanda este doar dry-run.",
        )

    def handle(self, *args, **options):
        try:
            import_home_ticket_benefits(
                options["file"],
                Users,
                using="default",
                apply=options["apply"],
                writer=self.stdout.write,
            )
        except HomeTicketImportError as exc:
            raise CommandError(str(exc)) from exc
