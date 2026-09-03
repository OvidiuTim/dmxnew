import json
import sqlite3
import uuid
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction
from django.db.models import Max

from ToolApp.models import AppUser, AttendanceSession, EmployeeTeam, Users


class Command(BaseCommand):
    help = (
        "Compare SQLite and PostgreSQL model counts and validate PostgreSQL "
        "constraints and sequences after a data copy."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--sqlite-path",
            default=str(settings.BASE_DIR / "db.sqlite3"),
            help="Path to the source SQLite database (opened read-only).",
        )
        parser.add_argument(
            "--database",
            default="default",
            help="PostgreSQL database alias to verify.",
        )
        parser.add_argument(
            "--test-write",
            action="store_true",
            help=(
                "Create a temporary employee and AppUser to verify IDs and PIN "
                "authentication, then roll the transaction back. Sequences still advance."
            ),
        )

    def handle(self, *args, **options):
        database = options["database"]
        postgres = connections[database]
        if postgres.vendor != "postgresql":
            raise CommandError(
                f"Database alias '{database}' uses {postgres.vendor}, not PostgreSQL."
            )

        sqlite_path = Path(options["sqlite_path"]).expanduser().resolve()
        if not sqlite_path.is_file():
            raise CommandError(f"SQLite database does not exist: {sqlite_path}")

        source = sqlite3.connect(f"file:{sqlite_path}?mode=ro", uri=True)
        try:
            models = list(apps.get_app_config("ToolApp").get_models()) + [
                apps.get_model("auth", "User"),
                apps.get_model("auth", "Group"),
            ]
            mismatches = []
            self.stdout.write("model\tsqlite\tpostgresql\tdifference")
            for model in models:
                table = model._meta.db_table.replace('"', '""')
                sqlite_count = source.execute(
                    f'SELECT COUNT(*) FROM "{table}"'
                ).fetchone()[0]
                postgres_count = model._base_manager.using(database).count()
                difference = postgres_count - sqlite_count
                self.stdout.write(
                    f"{model._meta.label}\t{sqlite_count}\t{postgres_count}\t{difference:+d}"
                )
                if difference:
                    mismatches.append(model._meta.label)

            sqlite_fk_failures = list(source.execute("PRAGMA foreign_key_check"))
        finally:
            source.close()

        with postgres.cursor() as cursor:
            cursor.execute(
                """
                SELECT conrelid::regclass::text, conname
                FROM pg_constraint
                WHERE connamespace = 'public'::regnamespace
                  AND contype IN ('f', 'c')
                  AND NOT convalidated
                ORDER BY 1, 2
                """
            )
            unvalidated_constraints = cursor.fetchall()
            cursor.execute(
                """
                SELECT indexrelid::regclass::text
                FROM pg_index
                JOIN pg_class table_class ON table_class.oid = indrelid
                JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
                WHERE namespace.nspname = 'public' AND NOT indisvalid
                ORDER BY 1
                """
            )
            invalid_indexes = cursor.fetchall()
            sequence_checks, sequence_failures = self._check_sequences(
                postgres, cursor
            )

        self.stdout.write(f"SQLite foreign-key failures: {len(sqlite_fk_failures)}")
        self.stdout.write(
            f"PostgreSQL unvalidated constraints: {len(unvalidated_constraints)}"
        )
        self.stdout.write(f"PostgreSQL invalid indexes: {len(invalid_indexes)}")
        self.stdout.write(f"PostgreSQL sequences checked: {sequence_checks}")
        self.stdout.write(f"PostgreSQL sequence failures: {len(sequence_failures)}")
        self.stdout.write(
            "Distinct worksites: "
            f"attendance={AttendanceSession.objects.using(database).exclude(worksite='').values('worksite').distinct().count()}, "
            f"teams={EmployeeTeam.objects.using(database).exclude(default_worksite='').values('default_worksite').distinct().count()}"
        )

        if options["test_write"]:
            result = self._test_write_and_authentication(database)
            self.stdout.write("Write/authentication test: " + json.dumps(result, sort_keys=True))
            if not all(result.values()):
                raise CommandError("The temporary write/authentication test failed.")

        problems = (
            mismatches
            or sqlite_fk_failures
            or unvalidated_constraints
            or invalid_indexes
            or sequence_failures
        )
        if problems:
            raise CommandError(
                "Database copy verification failed; inspect the details above."
            )
        self.stdout.write(self.style.SUCCESS("PostgreSQL copy verification passed."))

    @staticmethod
    def _check_sequences(connection, cursor):
        failures = []
        checks = 0
        for model in apps.get_models():
            primary_key = model._meta.pk
            if not primary_key or not model._meta.managed:
                continue
            table = model._meta.db_table
            column = primary_key.column
            quoted_table = connection.ops.quote_name(table)
            quoted_column = connection.ops.quote_name(column)
            cursor.execute(
                "SELECT pg_get_serial_sequence(%s, %s)",
                [quoted_table, column],
            )
            sequence = cursor.fetchone()[0]
            if not sequence:
                continue
            cursor.execute(f"SELECT MAX({quoted_column}) FROM {quoted_table}")
            maximum = cursor.fetchone()[0]
            cursor.execute(
                "SELECT pg_sequence_last_value(%s::regclass)", [sequence]
            )
            last_value = cursor.fetchone()[0]
            checks += 1
            if maximum is not None and (
                last_value is None or last_value < maximum
            ):
                failures.append((table, column, maximum, last_value))
        return checks, failures

    @staticmethod
    def _test_write_and_authentication(database):
        previous_user_id = (
            Users.objects.using(database).aggregate(value=Max("UserId"))["value"] or 0
        )
        previous_app_user_id = (
            AppUser.objects.using(database).aggregate(value=Max("AppUserId"))["value"]
            or 0
        )
        marker = f"__postgresql_copy_test_{uuid.uuid4().hex}__"
        with transaction.atomic(using=database):
            employee = Users.objects.using(database).create(
                UserName="PostgreSQL migration test",
                UserSerie=marker,
            )
            app_user = AppUser(employee=employee, username=marker, pin_hash="")
            app_user.set_pin("temporary-test-pin")
            app_user.save(using=database)
            result = {
                "employee_id_above_previous_max": employee.UserId > previous_user_id,
                "app_user_id_above_previous_max": (
                    app_user.AppUserId > previous_app_user_id
                ),
                "valid_pin_accepted": app_user.check_pin("temporary-test-pin"),
                "invalid_pin_rejected": not app_user.check_pin("wrong-pin"),
            }
            transaction.set_rollback(True, using=database)

        result["rows_rolled_back"] = (
            not Users.objects.using(database).filter(UserSerie=marker).exists()
            and not AppUser.objects.using(database).filter(username=marker).exists()
        )
        return result
