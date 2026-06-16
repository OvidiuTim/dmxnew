import re
import unicodedata

from django.core.management.base import BaseCommand, CommandError

from ToolApp.models import AppUser, Users


def normalize_username_part(value):
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-zA-Z0-9]+", "", text).lower()
    return text or "user"


def first_name_username(user):
    first = str(user.UserName or "").strip().split()[0]
    return normalize_username_part(first)


def unique_username(base):
    if not AppUser.objects.filter(username=base).exists():
        return base

    suffix = 2
    while AppUser.objects.filter(username=f"{base}{suffix}").exists():
        suffix += 1
    return f"{base}{suffix}"


class Command(BaseCommand):
    help = "Creeaza un AppUser legat de un angajat existent, cautat dupa PIN-ul angajatului."

    def add_arguments(self, parser):
        parser.add_argument(
            "--employee-pin",
            required=True,
            help="PIN-ul existent al angajatului din modelul Users.",
        )

    def handle(self, *args, **options):
        employee_pin = str(options["employee_pin"] or "").strip()
        if not employee_pin:
            raise CommandError("--employee-pin este obligatoriu.")

        matches = [user for user in Users.objects.all() if user.check_pin(employee_pin)]
        if not matches:
            raise CommandError(f"Nu exista angajat cu PIN-ul {employee_pin}.")
        if len(matches) > 1:
            names = ", ".join(f"{user.UserName} ({user.UserId})" for user in matches)
            raise CommandError(f"PIN-ul {employee_pin} este asociat la mai multi angajati: {names}")

        employee = matches[0]
        existing = AppUser.objects.filter(employee=employee).first()
        if existing:
            self.stdout.write(
                self.style.WARNING(
                    f"Exista deja AppUser pentru {employee.UserName}: username={existing.username}"
                )
            )
            return

        username = unique_username(first_name_username(employee))
        app_user = AppUser(employee=employee, username=username, is_active=True)
        app_user.set_pin(employee_pin)
        app_user.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"AppUser creat: username={app_user.username}, angajat={employee.UserName} ({employee.UserId})"
            )
        )
