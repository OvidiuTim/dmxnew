import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from ToolApp.models import Users


def normalize_name(value):
    return " ".join(str(value or "").split()).casefold()


def _normalized_row(row):
    return {
        "UserId": str(row.get("UserId") or row.get("user_id") or "").strip(),
        "UserSerie": str(row.get("UserSerie") or row.get("serie") or "").strip(),
        "UserName": str(row.get("UserName") or row.get("name") or "").strip(),
        "PIN": str(row.get("PIN") or row.get("pin") or row.get("UserPin") or "").strip(),
    }


def load_pin_rows(path):
    text = path.read_text(encoding="utf-8")
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return []

    delimiter = "\t" if "\t" in lines[0] else ","
    reader = csv.DictReader(lines, delimiter=delimiter)
    if not reader.fieldnames:
        raise CommandError("Fisierul trebuie sa aiba antet.")

    rows = []
    for index, raw in enumerate(reader, start=2):
        row = _normalized_row(raw)
        if not row["PIN"]:
            raise CommandError(f"Linia {index} nu are PIN.")
        if not row["UserId"] and not row["UserSerie"] and not row["UserName"]:
            raise CommandError(f"Linia {index} trebuie sa aiba UserId, UserSerie sau UserName.")
        rows.append({
            "line": index,
            **row,
        })
    return rows


class Command(BaseCommand):
    help = "Asociaza PIN-uri in clar angajatilor folosind UserId, UserSerie sau UserName."

    def add_arguments(self, parser):
        default_file = Path(__file__).resolve().parents[3] / "pin_assignments.tsv"
        parser.add_argument(
            "--file",
            default=str(default_file),
            help="Fisier TSV/CSV cu coloane UserId/UserSerie/UserName/PIN.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Verifica maparea fara sa scrie in baza de date.",
        )

    def handle(self, *args, **options):
        source = Path(options["file"]).expanduser().resolve()
        if not source.exists():
            raise CommandError(f"Fisierul nu exista: {source}")

        rows = load_pin_rows(source)
        if not rows:
            raise CommandError("Fisierul nu contine nicio asociere de PIN.")

        users_by_name = {}
        users_by_serie = {}
        users_by_id = {}
        for user in Users.objects.all().order_by("UserName", "UserId"):
            users_by_id[str(user.UserId)] = user
            users_by_serie[str(user.UserSerie or "").strip()] = user
            users_by_name.setdefault(normalize_name(user.UserName), []).append(user)

        deduped_rows = {}
        overwritten = []
        for row in rows:
            dedupe_key = (
                f"id:{row['UserId']}" if row["UserId"] else
                f"serie:{row['UserSerie']}" if row["UserSerie"] else
                f"name:{normalize_name(row['UserName'])}"
            )
            previous = deduped_rows.get(dedupe_key)
            if previous and previous["PIN"] != row["PIN"]:
                label = row["UserId"] or row["UserSerie"] or row["UserName"]
                overwritten.append(f"{label}: {previous['PIN']} -> {row['PIN']}")
            deduped_rows[dedupe_key] = row

        missing = []
        ambiguous = []
        updates = []

        for row in deduped_rows.values():
            user = None

            if row["UserId"]:
                user = users_by_id.get(row["UserId"])
                if not user:
                    missing.append(f"linia {row['line']}: UserId {row['UserId']} (PIN {row['PIN']})")
                    continue
            elif row["UserSerie"]:
                user = users_by_serie.get(row["UserSerie"])
                if not user:
                    missing.append(f"linia {row['line']}: UserSerie {row['UserSerie']} (PIN {row['PIN']})")
                    continue
            else:
                matches = users_by_name.get(normalize_name(row["UserName"]), [])
                if not matches:
                    missing.append(f"linia {row['line']}: {row['UserName']} (PIN {row['PIN']})")
                    continue
                if len(matches) > 1:
                    ambiguous.append(
                        f"linia {row['line']}: {row['UserName']} -> user ids {[user.UserId for user in matches]}"
                    )
                    continue
                user = matches[0]

            updates.append((user, row["PIN"]))

        if overwritten:
            self.stdout.write(self.style.WARNING("Au existat chei duplicate in fisier; s-a pastrat ultimul PIN:"))
            for item in overwritten:
                self.stdout.write(f"  - {item}")

        if missing:
            raise CommandError(
                "Nu am gasit urmatorii utilizatori in baza de date:\n- " + "\n- ".join(missing)
            )

        if ambiguous:
            raise CommandError(
                "Exista utilizatori multipli cu acelasi nume in baza de date. Adauga UserSerie sau UserId in fisier pentru aceste linii:\n- "
                + "\n- ".join(ambiguous)
            )

        changed = 0
        unchanged = 0

        for user, pin in updates:
            current_pin = str(user.UserPin or "").strip()
            if current_pin == pin and not user.pin_hash and not user.pin_lookup:
                unchanged += 1
                continue

            changed += 1
            if not options["dry_run"]:
                user.set_pin(pin)
                user.save(update_fields=["UserPin", "pin_hash", "pin_lookup"])

        mode = "DRY RUN" if options["dry_run"] else "APLICAT"
        self.stdout.write(self.style.SUCCESS(
            f"{mode}: {changed} utilizatori actualizati, {unchanged} deja corecti, {len(updates)} mapari validate."
        ))
