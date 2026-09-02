from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import TestCase
from openpyxl import Workbook

from ToolApp.models import Users


class ImportEmployeeSalariesCommandTests(TestCase):
    def setUp(self):
        self.ion = Users.objects.create(
            UserName="Ion Popescu U1234567",
            UserSerie="1234567890123_U1234567_CIM 01.01.2026",
            Company="DMX",
            person_type=Users.PersonType.EMPLOYEE,
        )
        self.xmeg = Users.objects.create(
            UserName="David Gheorghe Dumitru // notă internă",
            UserSerie="XMEG-1",
            Company="XMEG CONSTRUCT",
            person_type=Users.PersonType.EMPLOYEE,
        )
        Users.objects.create(
            UserName="Davinder Singh R5213071",
            UserSerie="7850722320031_R5213071",
            Company="VB-ROM",
            person_type=Users.PersonType.EMPLOYEE,
        )

    def make_workbook(self, directory):
        path = Path(directory) / "salarii-test.xlsx"
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "DMX"
        sheet.append([None, None, None, "SALARII IULIE 2026"])
        sheet.append([None, None, "NR. CRT.", "NUME/PRENUME ANGAJAT"])
        sheet.append([
            None, None, "DMX CONSTRUCTION", None, "Avans Salar", "Poprire",
            "Lichidare", "Tichete", "net+tichete stat plata",
        ])
        sheet.append([None, None, 1, "POPESCU ION_1234567890123_U1234567_CIM", 1000, 200, 3000, 400, 4600])
        sheet.append([None, None, 2, "NUME NEGĂSIT_CIM", 500, None, 900, 100, 1500])
        # Același angajat pe încă un rând trebuie agregat, nu suprascris.
        sheet.append([None, None, 3, "ION POPESCU_1234567890123", 100, None, 200, 0, 300])
        sheet.append([None, None, 4, "DALVIR SINGH", 100, None, 200, 0, 300])

        xmeg = workbook.create_sheet("XMEG")
        xmeg.append([])
        xmeg.append([None, None, None, "XMEG", None, "AVANS STAT PLATA", "DIF", None, "lichidare", "tichete", "total stat plata"])
        xmeg.append([None, None, None, "DAVID GH DUMITRU", 1800, 534, 1266, None, 2741, 760, 4035])
        workbook.save(path)
        return path

    def test_dry_run_lists_unmatched_and_does_not_change_database(self):
        with TemporaryDirectory() as directory:
            path = self.make_workbook(directory)
            output = StringIO()
            call_command("import_employee_salaries", str(path), stdout=output)

        self.ion.refresh_from_db()
        self.assertIsNone(self.ion.total_salary_ron)
        self.assertIn("Nume negăsite: 2", output.getvalue())
        self.assertIn("NUME NEGĂSIT", output.getvalue())
        self.assertIn("DALVIR SINGH", output.getvalue())
        self.assertIn("DRY-RUN", output.getvalue())

    def test_apply_imports_fields_adds_garnishment_and_uses_labeled_xmeg_advance(self):
        with TemporaryDirectory() as directory:
            path = self.make_workbook(directory)
            output = StringIO()
            call_command("import_employee_salaries", str(path), "--apply", stdout=output)

        self.ion.refresh_from_db()
        self.assertEqual(str(self.ion.total_salary_ron), "4900.00")
        self.assertEqual(str(self.ion.salary_advance_ron), "1100.00")
        self.assertEqual(str(self.ion.salary_remainder_ron), "3400.00")
        self.assertEqual(str(self.ion.meal_vouchers_ron), "400.00")

        self.xmeg.refresh_from_db()
        self.assertEqual(str(self.xmeg.total_salary_ron), "4035.00")
        self.assertEqual(str(self.xmeg.salary_advance_ron), "534.00")
        self.assertEqual(str(self.xmeg.salary_remainder_ron), "2741.00")
        self.assertEqual(str(self.xmeg.meal_vouchers_ron), "760.00")
        self.assertIn("coloana DIF (1266.00 lei) a fost ignorată", output.getvalue())
        self.assertIn("Import finalizat: 2 angajați actualizați", output.getvalue())
