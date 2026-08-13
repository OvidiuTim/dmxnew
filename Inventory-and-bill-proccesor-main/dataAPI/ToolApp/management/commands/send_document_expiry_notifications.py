from datetime import date

from django.core.management.base import BaseCommand

from ToolApp.document_expiry_email import (
    DOCUMENT_EXPIRY_RECIPIENTS,
    process_due_document_expiry_notifications,
)


class Command(BaseCommand):
    help = "Trimite o singură notificare pentru documentele angajaților care expiră în maximum 14 zile."

    def add_arguments(self, parser):
        parser.add_argument("--date", help="Data de referință YYYY-MM-DD. Implicit: astăzi.")
        parser.add_argument("--only", help="Trimite numai către această adresă (util pentru test).")
        parser.add_argument("--dry-run", action="store_true", help="Afișează documentele fără a trimite email.")

    def handle(self, *args, **options):
        reference_date = date.fromisoformat(options["date"]) if options.get("date") else None
        recipients = [options["only"]] if options.get("only") else list(DOCUMENT_EXPIRY_RECIPIENTS)
        documents = process_due_document_expiry_notifications(
            reference_date=reference_date,
            recipients=recipients,
            dry_run=options["dry_run"],
        )
        self.stdout.write(f"Destinatari: {', '.join(recipients)}")
        for item in documents:
            self.stdout.write(
                f"- {item.employee.UserName} | {item.document_type.name} | {item.expiry_date.isoformat()}"
            )
        label = "identificate" if options["dry_run"] else "notificate"
        self.stdout.write(self.style.SUCCESS(f"Documente {label}: {len(documents)}"))
