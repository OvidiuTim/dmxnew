from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connections


class Command(BaseCommand):
    help = "Reset all PostgreSQL model sequences after loading data with explicit IDs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--database",
            default="default",
            help="Database alias whose PostgreSQL sequences should be reset.",
        )

    def handle(self, *args, **options):
        database = options["database"]
        connection = connections[database]
        if connection.vendor != "postgresql":
            raise CommandError(
                f"Database alias '{database}' uses {connection.vendor}, not PostgreSQL."
            )

        models = [
            model
            for model in apps.get_models(include_auto_created=True)
            if model._meta.managed and model._meta.can_migrate(connection)
        ]
        statements = connection.ops.sequence_reset_sql(no_style(), models)
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)

        self.stdout.write(
            self.style.SUCCESS(
                f"Reset {len(statements)} PostgreSQL sequence(s) on '{database}'."
            )
        )
