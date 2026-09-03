import hashlib
import json
import re
from collections import Counter
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError


ZERO_FRACTION_UTC = re.compile(r"\.0+Z$")


def normalize(value):
    if isinstance(value, dict):
        return {key: normalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalize(item) for item in value]
    if isinstance(value, str):
        return ZERO_FRACTION_UTC.sub("Z", value)
    return value


def load_fixture(path):
    try:
        rows = normalize(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError) as exc:
        raise CommandError(f"Cannot read fixture {path}: {exc}") from exc
    rows.sort(
        key=lambda row: (
            row["model"].lower(),
            repr(row.get("pk")),
            json.dumps(row["fields"], sort_keys=True),
        )
    )
    payload = json.dumps(
        rows,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    return rows, hashlib.sha256(payload).hexdigest()


class Command(BaseCommand):
    help = "Compare two Django JSON fixtures after harmless timestamp normalization."

    def add_arguments(self, parser):
        parser.add_argument("source")
        parser.add_argument("destination")

    def handle(self, *args, **options):
        source_path = Path(options["source"]).expanduser().resolve()
        destination_path = Path(options["destination"]).expanduser().resolve()
        source, source_hash = load_fixture(source_path)
        destination, destination_hash = load_fixture(destination_path)

        self.stdout.write(f"Source objects: {len(source)}")
        self.stdout.write(f"Destination objects: {len(destination)}")
        self.stdout.write(f"Source semantic SHA-256: {source_hash}")
        self.stdout.write(f"Destination semantic SHA-256: {destination_hash}")
        if source == destination:
            self.stdout.write(self.style.SUCCESS("Fixture contents match."))
            return

        source_counts = Counter(row["model"].lower() for row in source)
        destination_counts = Counter(row["model"].lower() for row in destination)
        for model in sorted(source_counts.keys() | destination_counts.keys()):
            if source_counts[model] != destination_counts[model]:
                self.stderr.write(
                    f"{model}: source={source_counts[model]}, "
                    f"destination={destination_counts[model]}"
                )
        raise CommandError("Fixture contents differ.")
