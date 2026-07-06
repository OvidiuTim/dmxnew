import os
import tempfile
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from openpyxl import Workbook

from ToolApp.models import Tools


HEADERS = [
    "ID intern",
    "Nr. inventar sursă",
    "Denumire sculă / echipament",
    "Categorie",
    "Marcă",
    "Model",
    "Serie / SN",
    "Cantitate",
    "Stare",
    "Locație",
    "Responsabil",
    "Observații",
    "Necesită verificare",
    "Poză sursă",
]


class ImportToolsXlsxTests(TestCase):
    def setUp(self):
        super().setUp()
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Inventar extras"
        sheet.append(HEADERS)
        sheet.append(
            [
                "SC-0001",
                1,
                "Demolator Hilti",
                "Rotopercutoare / demolatoare",
                "HILTI",
                "TE 3000",
                "SN-123",
                "2 BUC",
                "Defect",
                None,
                None,
                "Mâner lipsă",
                "DA",
                "poza_01",
            ]
        )
        sheet.append(
            [
                "SC-0002",
                2,
                "Cască protecție",
                "Siguranță / protecție",
                None,
                None,
                None,
                None,
                "De verificat",
                None,
                None,
                None,
                "NU",
                "poza_02",
            ]
        )
        handle, self.path = tempfile.mkstemp(suffix=".xlsx")
        os.close(handle)
        workbook.save(self.path)
        workbook.close()

    def tearDown(self):
        if os.path.exists(self.path):
            os.unlink(self.path)
        super().tearDown()

    def test_dry_run_does_not_write(self):
        output = StringIO()

        call_command("import_tools_xlsx", self.path, dry_run=True, stdout=output)

        self.assertEqual(Tools.objects.count(), 0)
        self.assertIn("DRY-RUN finalizat", output.getvalue())
        self.assertIn("de creat: 2", output.getvalue())

    def test_import_maps_inventory_fields_and_is_idempotent(self):
        call_command("import_tools_xlsx", self.path, stdout=StringIO())

        self.assertEqual(Tools.objects.count(), 2)
        broken = Tools.objects.get(ToolSerie="SC-0001")
        self.assertEqual(broken.ToolName, "Demolator Hilti")
        self.assertEqual(broken.Pieces, 2)
        self.assertEqual(broken.Status, Tools.ToolStatus.STRICATA)
        self.assertEqual(broken.MainLocation, "Magazie")
        self.assertEqual(broken.Brand, "HILTI")
        self.assertEqual(broken.Model, "TE 3000")
        self.assertEqual(broken.SerialNumber, "SN-123")
        self.assertEqual(broken.SourceInventoryNumber, 1)
        self.assertTrue(broken.RequiresVerification)

        ssm = Tools.objects.get(ToolSerie="SC-0002")
        self.assertTrue(ssm.IsSSM)
        self.assertEqual(ssm.Status, Tools.ToolStatus.MAGAZIE)
        self.assertTrue(ssm.RequiresVerification)

        output = StringIO()
        call_command("import_tools_xlsx", self.path, stdout=output)
        self.assertEqual(Tools.objects.count(), 2)
        self.assertIn("existente omise: 2", output.getvalue())

    def test_update_existing_is_explicit(self):
        call_command("import_tools_xlsx", self.path, stdout=StringIO())
        tool = Tools.objects.get(ToolSerie="SC-0001")
        tool.ToolName = "Nume editat în aplicație"
        tool.save(update_fields=["ToolName"])

        call_command("import_tools_xlsx", self.path, stdout=StringIO())
        tool.refresh_from_db()
        self.assertEqual(tool.ToolName, "Nume editat în aplicație")

        call_command(
            "import_tools_xlsx",
            self.path,
            update_existing=True,
            stdout=StringIO(),
        )
        tool.refresh_from_db()
        self.assertEqual(tool.ToolName, "Demolator Hilti")
