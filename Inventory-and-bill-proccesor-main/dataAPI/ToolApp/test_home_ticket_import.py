from datetime import date, datetime
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.conf import settings
from django.core.management import call_command
from django.db.models.query import QuerySet
from django.test import TestCase
from openpyxl import Workbook

from ToolApp.home_ticket_import import (
    import_home_ticket_benefits,
    read_home_ticket_workbook,
)
from ToolApp.models import Users


HEADERS = (
    "employee_name",
    "hire_date",
    "ticket_bonus_eligible",
    "company_paid_ticket_before",
    "last_paid_ticket_departure_date",
)


class HomeTicketImportTests(TestCase):
    def make_workbook(self, directory, rows, *, sheet_name="DMX"):
        path = Path(directory) / "home-ticket-test.xlsx"
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = sheet_name
        sheet.append(HEADERS)
        for row in rows:
            sheet.append(row)
        workbook.save(path)
        return path

    def test_reads_excel_dates_and_trimmed_case_insensitive_yes_no(self):
        with TemporaryDirectory() as directory:
            path = self.make_workbook(directory, [
                (
                    "POPESCU ION_1234567890123_U1234567_CIM",
                    date(2024, 1, 2),
                    "  Da  ",
                    " dA ",
                    datetime(2025, 3, 4, 12, 30),
                ),
                (
                    "IONESCU ANA_CIM",
                    "05.06.2023",
                    " NU ",
                    " nU ",
                    None,
                ),
            ])
            total, rows, ignored = read_home_ticket_workbook(path)

        self.assertEqual(total, 2)
        self.assertEqual(ignored, [])
        first = {operation.field_name: operation.value for operation in rows[0].operations}
        second = {operation.field_name: operation.value for operation in rows[1].operations}
        self.assertEqual(first, {
            "hire_date": date(2024, 1, 2),
            "ticket_benefit_enabled": True,
            "last_home_trip_date": date(2025, 3, 4),
        })
        self.assertEqual(second, {
            "hire_date": date(2023, 6, 5),
            "ticket_benefit_enabled": False,
            "last_home_trip_date": None,
        })

    def test_invalid_values_only_block_their_own_fields(self):
        employee = Users.objects.create(
            UserName="Nume Invalid",
            UserSerie="INV-1",
            hire_date=date(2020, 1, 1),
            ticket_benefit_enabled=True,
            last_home_trip_date=date(2022, 2, 2),
        )
        partial = Users.objects.create(
            UserName="Fara Istoric",
            UserSerie="INV-2",
            last_home_trip_date=date(2021, 1, 1),
        )
        with TemporaryDirectory() as directory:
            path = self.make_workbook(directory, [
                ("NUME INVALID", "01.07", "poate", "nu", None),
                ("FARA ISTORIC", "01.01.2024", "da", None, None),
            ])
            report = import_home_ticket_benefits(
                path,
                Users,
                apply=True,
                writer=lambda _line: None,
            )

        employee.refresh_from_db()
        partial.refresh_from_db()
        self.assertEqual(report.total_rows, 2)
        self.assertEqual(len(report.ignored_values), 2)
        self.assertEqual(
            {issue.field_name for issue in report.ignored_values},
            {"hire_date", "ticket_bonus_eligible"},
        )
        self.assertEqual(employee.hire_date, date(2020, 1, 1))
        self.assertTrue(employee.ticket_benefit_enabled)
        self.assertIsNone(employee.last_home_trip_date)
        self.assertEqual(partial.hire_date, date(2024, 1, 1))
        self.assertTrue(partial.ticket_benefit_enabled)
        self.assertEqual(partial.last_home_trip_date, date(2021, 1, 1))
        self.assertEqual(report.updated_fields, {
            "hire_date": 1,
            "ticket_benefit_enabled": 1,
            "last_home_trip_date": 1,
        })

    def test_identifier_precedes_ambiguous_name_and_only_allowed_fields_change(self):
        selected = Users.objects.create(
            UserName="Ion Popescu U1234567",
            UserSerie="1234567890123_U1234567_CIM 01.01.2020",
            Company="DMX",
            phone_number="0700000000",
            hire_date=date(2020, 1, 1),
            ticket_benefit_enabled=False,
            last_home_trip_date=date(2021, 1, 1),
        )
        Users.objects.create(
            UserName="Ion Popescu U7654321",
            UserSerie="1999999999999_U7654321",
            Company="VB-ROM",
        )

        with TemporaryDirectory() as directory:
            path = self.make_workbook(directory, [
                (
                    "POPESCU ION, 1234567890123, u 1234567, CIM",
                    "02.02.2024",
                    "da",
                    "nu",
                    "05.05.2025",
                ),
            ])
            report = import_home_ticket_benefits(
                path,
                Users,
                apply=True,
                writer=lambda _line: None,
            )

        selected.refresh_from_db()
        self.assertEqual(report.updated, 1)
        self.assertEqual(report.updated_fields, {
            "hire_date": 1,
            "ticket_benefit_enabled": 1,
            "last_home_trip_date": 1,
        })
        self.assertEqual(len(report.ignored_values), 1)
        self.assertEqual(
            report.ignored_values[0].field_name,
            "last_paid_ticket_departure_date",
        )
        self.assertEqual(report.ambiguous, [])
        self.assertEqual(selected.hire_date, date(2024, 2, 2))
        self.assertTrue(selected.ticket_benefit_enabled)
        self.assertIsNone(selected.last_home_trip_date)
        self.assertEqual(selected.Company, "DMX")
        self.assertEqual(selected.phone_number, "0700000000")
        self.assertEqual(Users.objects.count(), 2)

    def test_name_fallback_is_safe_and_idempotent(self):
        employee = Users.objects.create(
            UserName="Șapaiya Sunil // notă internă",
            UserSerie="intern-42",
            Company="DMX",
        )
        with TemporaryDirectory() as directory:
            path = self.make_workbook(directory, [
                ("SUNIL SAPAIYA CIM", "13.05.2025", "da", "da", "01.03.2026"),
            ])
            first = import_home_ticket_benefits(
                path, Users, apply=True, writer=lambda _line: None
            )
            second = import_home_ticket_benefits(
                path, Users, apply=True, writer=lambda _line: None
            )

        employee.refresh_from_db()
        self.assertEqual(first.updated, 1)
        self.assertEqual(first.unchanged, 0)
        self.assertEqual(second.updated, 0)
        self.assertEqual(second.unchanged, 1)
        self.assertEqual(sum(first.updated_fields.values()), 3)
        self.assertEqual(sum(second.unchanged_fields.values()), 3)
        self.assertEqual(employee.last_home_trip_date, date(2026, 3, 1))
        self.assertEqual(Users.objects.count(), 1)

    def test_ambiguous_name_and_conflicting_duplicate_rows_are_not_updated(self):
        first = Users.objects.create(UserName="Ana Maria", UserSerie="A-1")
        Users.objects.create(UserName="Ana-Maria", UserSerie="A-2")
        unique = Users.objects.create(
            UserName="Angajat Unic",
            UserSerie="U-1",
            last_home_trip_date=date(2020, 1, 1),
        )
        with TemporaryDirectory() as directory:
            path = self.make_workbook(directory, [
                ("ANA MARIA", "01.01.2024", "da", "nu", None),
                ("ANGAJAT UNIC", "01.02.2024", "da", "nu", None),
                ("ANGAJAT UNIC", "01.03.2024", "da", "nu", None),
            ])
            report = import_home_ticket_benefits(
                path, Users, apply=True, writer=lambda _line: None
            )

        first.refresh_from_db()
        unique.refresh_from_db()
        self.assertEqual(report.updated, 1)
        self.assertEqual(len(report.ambiguous), 1)
        self.assertEqual(len(report.ignored_values), 2)
        self.assertIsNone(first.hire_date)
        self.assertIsNone(unique.hire_date)
        self.assertTrue(unique.ticket_benefit_enabled)
        self.assertIsNone(unique.last_home_trip_date)

    def test_blank_paid_flag_with_valid_departure_date_implies_used_ticket(self):
        employee = Users.objects.create(
            UserName="Istoric Implicit",
            UserSerie="HIST-1",
        )
        with TemporaryDirectory() as directory:
            path = self.make_workbook(directory, [
                ("ISTORIC IMPLICIT", None, None, None, "03.04.2025"),
            ])
            report = import_home_ticket_benefits(
                path, Users, apply=True, writer=lambda _line: None
            )

        employee.refresh_from_db()
        self.assertEqual(employee.last_home_trip_date, date(2025, 4, 3))
        self.assertEqual(report.updated_fields["last_home_trip_date"], 1)
        self.assertEqual(report.ignored_values, [])

    def test_paid_yes_without_valid_date_does_not_block_other_fields(self):
        employee = Users.objects.create(UserName="Istoric Invalid", UserSerie="HIST-2")
        with TemporaryDirectory() as directory:
            path = self.make_workbook(directory, [
                ("ISTORIC INVALID", "01.02.2024", "da", "da", "31.02.2025"),
            ])
            report = import_home_ticket_benefits(
                path, Users, apply=True, writer=lambda _line: None
            )

        employee.refresh_from_db()
        self.assertEqual(employee.hire_date, date(2024, 2, 1))
        self.assertTrue(employee.ticket_benefit_enabled)
        self.assertIsNone(employee.last_home_trip_date)
        self.assertEqual(report.updated_fields["hire_date"], 1)
        self.assertEqual(report.updated_fields["ticket_benefit_enabled"], 1)
        self.assertEqual(report.updated_fields["last_home_trip_date"], 0)
        self.assertEqual(report.ignored_values[0].field_name, "last_paid_ticket_departure_date")

    def test_current_workbook_exposes_expected_valid_field_counts(self):
        path = (
            Path(settings.BASE_DIR)
            / "ToolApp"
            / "data"
            / "bonus_avion_excel_general.xlsx"
        )
        total, rows, ignored = read_home_ticket_workbook(path)
        operation_counts = {
            field_name: sum(
                operation.field_name == field_name
                for row in rows
                for operation in row.operations
            )
            for field_name in (
                "hire_date",
                "ticket_benefit_enabled",
                "last_home_trip_date",
            )
        }

        self.assertEqual(total, 151)
        self.assertEqual(operation_counts["hire_date"], 137)
        self.assertEqual(operation_counts["ticket_benefit_enabled"], 132)
        self.assertEqual(operation_counts["last_home_trip_date"], 12)
        self.assertEqual(len(ignored), 3)

    def test_command_is_dry_run_by_default_and_prints_required_summary(self):
        Users.objects.create(UserName="Comanda Test", UserSerie="CMD-1")
        with TemporaryDirectory() as directory:
            path = self.make_workbook(directory, [
                ("COMANDA TEST", "01.01.2024", "da", "nu", None),
                ("NEGASIT TEST", "01.01.2024", "nu", "nu", None),
            ])
            output = StringIO()
            call_command("import_home_ticket_benefits", str(path), stdout=output)

        employee = Users.objects.get(UserSerie="CMD-1")
        rendered = output.getvalue()
        self.assertIsNone(employee.hire_date)
        self.assertIn("Rânduri citite: 2", rendered)
        self.assertIn("Angajați cu cel puțin un câmp actualizat: 1", rendered)
        self.assertIn("Date de angajare actualizate: 1", rendered)
        self.assertIn("Eligibilități actualizate: 1", rendered)
        self.assertIn("Istorice de bilet actualizate: 0", rendered)
        self.assertIn("Istorice de bilet deja nemodificate: 1", rendered)
        self.assertIn("Angajați negăsiți în aplicație: 1", rendered)
        self.assertIn("DMX!r3", rendered)
        self.assertIn("employee_name='NEGASIT TEST'", rendered)
        self.assertIn("DRY-RUN", rendered)

    def test_unexpected_write_error_rolls_back_all_employee_updates(self):
        first = Users.objects.create(UserName="Primul Angajat", UserSerie="ROLL-1")
        second = Users.objects.create(UserName="Al Doilea", UserSerie="ROLL-2")
        with TemporaryDirectory() as directory:
            path = self.make_workbook(directory, [
                ("PRIMUL ANGAJAT", "01.01.2024", "da", "nu", None),
                ("AL DOILEA", "02.02.2024", "da", "nu", None),
            ])
            original_update = QuerySet.update
            ticket_update_calls = 0

            def fail_second_ticket_update(queryset, **kwargs):
                nonlocal ticket_update_calls
                if "ticket_benefit_enabled" in kwargs:
                    ticket_update_calls += 1
                    if ticket_update_calls == 2:
                        raise RuntimeError("scriere simulată eșuată")
                return original_update(queryset, **kwargs)

            with patch.object(QuerySet, "update", new=fail_second_ticket_update):
                with self.assertRaisesRegex(RuntimeError, "scriere simulată eșuată"):
                    import_home_ticket_benefits(
                        path, Users, apply=True, writer=lambda _line: None
                    )

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertIsNone(first.hire_date)
        self.assertIsNone(second.hire_date)
