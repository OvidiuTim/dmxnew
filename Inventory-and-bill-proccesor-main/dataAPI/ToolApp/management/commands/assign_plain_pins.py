from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from ToolApp.models import Users


def normalize_name(value):
    return " ".join(str(value or "").split()).casefold()


def load_pin_rows(path):
    rows = []
    raw_lines = path.read_text(encoding="utf-8").splitlines()
    for index, line in enumerate(raw_lines, start=1):
        stripped = line.strip()
        if not stripped:
            continue
        if index == 1 and stripped.casefold() in {"username\tpin", "username,pin"}:
            continue

        if "\t" in line:
            name, pin = line.rsplit("\t", 1)
        elif "," in line:
            name, pin = line.rsplit(",", 1)
        else:
            raise CommandError(f"Linia {index} nu are separator valid TAB sau virgula.")

        name = name.strip()
        pin = pin.strip()
        if not name or not pin:
            raise CommandError(f"Linia {index} este incompleta.")

        rows.append({
            "line": index,
            "name": name,
            "pin": pin,
        })
    return rows


class Command(BaseCommand):
    help = "Asociaza PIN-uri in clar angajatilor pe baza numelui."

    def add_arguments(self, parser):
        default_file = Path(__file__).resolve().parents[3] / "pin_assignments.tsv"
        parser.add_argument(
            "--file",
            default=str(default_file),
            help="Fisier TSV/CSV cu coloanele UserName si PIN.",
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
        for user in Users.objects.all().order_by("UserName", "UserId"):
            key = normalize_name(user.UserName)
            users_by_name.setdefault(key, []).append(user)

        deduped_rows = {}
        overwritten = []
        for row in rows:
            key = normalize_name(row["name"])
            previous = deduped_rows.get(key)
            if previous and previous["pin"] != row["pin"]:
                overwritten.append(
                    f"{row['name']}: {previous['pin']} -> {row['pin']}"
                )
            deduped_rows[key] = row

        missing = []
        ambiguous = []
        updates = []

        for key, row in deduped_rows.items():
            matches = users_by_name.get(key, [])
            if not matches:
                missing.append(f"{row['name']} (PIN {row['pin']})")
                continue
            if len(matches) > 1:
                ambiguous.append(
                    f"{row['name']} -> user ids {[user.UserId for user in matches]}"
                )
                continue
            updates.append((matches[0], row["pin"]))

        if overwritten:
            self.stdout.write(self.style.WARNING("Au existat nume duplicate in fisier; s-a pastrat ultimul PIN:"))
            for item in overwritten:
                self.stdout.write(f"  - {item}")

        if missing:
            raise CommandError(
                "Nu am gasit urmatorii utilizatori in baza de date:\n- " + "\n- ".join(missing)
            )

        if ambiguous:
            raise CommandError(
                "Exista utilizatori multipli cu acelasi nume in baza de date:\n- " + "\n- ".join(ambiguous)
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
