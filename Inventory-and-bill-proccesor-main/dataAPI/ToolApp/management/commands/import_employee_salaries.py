from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from ToolApp.models import Users
from ToolApp.salary_import import (
    IMPORTED_SALARY_FIELDS,
    SalarySourceError,
    aggregate_salary_rows,
    match_salary_row,
    parse_salary_files,
)


DEFAULT_FILES = (
    "Salarii Iulie pt DMX & others .xls",
    "Copy of Salarii Iulie pt VB-ROM si XMEG.xlsx",
)


class Command(BaseCommand):
    help = (
        "Importă salariul total, avansul, restul și bonurile din fișierele salariale. "
        "Implicit face doar previzualizare; --apply scrie în baza de date."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "files",
            nargs="*",
            help="Fișiere .xls/.xlsx; implicit folosește cele două fișiere din dataAPI.",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Aplică valorile pentru angajații asociați sigur.",
        )
        parser.add_argument(
            "--require-matches", action="store_true",
            help="Eșuează dacă niciun angajat nu poate fi asociat (pentru scriptul de deploy).",
        )

    def handle(self, *args, **options):
        paths = [Path(value).expanduser() for value in options["files"]]
        if not paths:
            paths = [Path(settings.BASE_DIR) / name for name in DEFAULT_FILES]

        try:
            source_rows = parse_salary_files(paths)
        except SalarySourceError as exc:
            raise CommandError(str(exc)) from exc

        employees = list(
            Users.objects.filter(person_type=Users.PersonType.EMPLOYEE).order_by("UserName", "UserId")
        )
        matched = []
        unmatched = []
        ambiguous = []
        for row in source_rows:
            employee, candidates = match_salary_row(row, employees)
            if employee:
                matched.append((row, employee))
            elif candidates:
                ambiguous.append((row, candidates))
            else:
                unmatched.append(row)

        aggregated = aggregate_salary_rows(matched)
        garnishment_rows = [row for row, _employee in matched if row.garnishment]
        ignored_difference = sum((row.ignored_difference for row in source_rows), start=0)

        self.stdout.write(self.style.MIGRATE_HEADING("Previzualizare import salarii"))
        self.stdout.write("Fișiere: " + ", ".join(str(path) for path in paths))
        self.stdout.write(f"Rânduri salariale citite: {len(source_rows)}")
        self.stdout.write(self.style.SUCCESS(f"Rânduri asociate sigur: {len(matched)}"))
        self.stdout.write(self.style.SUCCESS(f"Angajați care vor fi actualizați: {len(aggregated)}"))
        self.stdout.write(self.style.WARNING(f"Nume negăsite: {len(unmatched)}"))
        self.stdout.write(self.style.WARNING(f"Asocieri ambigue: {len(ambiguous)}"))
        partial = [item for item in aggregated.values() if any(item[field] is None for field in IMPORTED_SALARY_FIELDS)]
        self.stdout.write(f"Angajați cu date incomplete (câmpurile lipsă se păstrează): {len(partial)}")
        self.stdout.write(
            f"Popriri adăugate la rest: {len(garnishment_rows)} rânduri, "
            f"total {sum((row.garnishment for row in garnishment_rows), start=0):.2f} lei"
        )
        self.stdout.write(
            "Regulă total: se păstrează coloana totală explicită din Excel; "
            "bonurile se salvează și separat."
        )
        if ignored_difference:
            self.stdout.write(self.style.WARNING(
                f"XMEG: coloana DIF ({ignored_difference:.2f} lei) a fost ignorată; "
                "avansul vine din coloana etichetată AVANS STAT PLATA."
            ))

        if unmatched:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Nume negăsite în aplicație:"))
            for row in unmatched:
                self.stdout.write(f"  - {row.employee_name} · {row.company or 'companie nespecificată'} · {row.location}")

        if ambiguous:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Asocieri ambigue (nu sunt importate):"))
            for row, candidates in ambiguous:
                names = ", ".join(f"{item.UserName} [ID {item.UserId}]" for item in candidates)
                self.stdout.write(f"  - {row.employee_name} · {row.location} => {names}")

        repeated = [item for item in aggregated.values() if len(item["rows"]) > 1]
        if repeated:
            self.stdout.write("")
            self.stdout.write("Angajați prezenți pe mai multe rânduri (valorile au fost adunate):")
            for item in repeated:
                self.stdout.write(
                    f"  - {item['employee'].UserName}: {len(item['rows'])} rânduri, "
                    f"total {item['total_salary_ron'] if item['total_salary_ron'] is not None else 'nespecificat, păstrat'} lei"
                )

        if options["require_matches"] and not aggregated:
            raise CommandError("Niciun angajat asociat; importul nu a fost aplicat.")

        for item in aggregated.values():
            for field in IMPORTED_SALARY_FIELDS:
                value = item[field]
                if value is not None and value > Decimal("9999999999.99"):
                    raise CommandError(f"{item['employee'].UserName}: valoarea pentru {field} depășește limita câmpului.")

        if not options["apply"]:
            self.stdout.write("")
            self.stdout.write(self.style.NOTICE(
                "DRY-RUN: baza de date nu a fost modificată. Rulează din nou cu --apply după verificarea listei."
            ))
            return

        with transaction.atomic():
            for employee_id, item in aggregated.items():
                # UPDATE doar pe câmpurile cunoscute: nici câmpurile lipsă,
                # nici alte date modificate între timp nu sunt suprascrise.
                Users.objects.filter(pk=employee_id).update(**{
                    field: item[field] for field in IMPORTED_SALARY_FIELDS
                    if item[field] is not None
                })

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Import finalizat: {len(aggregated)} angajați actualizați; "
            f"{len(unmatched)} nume negăsite; {len(ambiguous)} asocieri ambigue."
        ))
