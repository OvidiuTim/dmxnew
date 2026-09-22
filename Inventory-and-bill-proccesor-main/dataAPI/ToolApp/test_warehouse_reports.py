import io
from datetime import date, datetime, time

from django.test import Client, TestCase
from django.utils import timezone
from openpyxl import load_workbook

from ToolApp.models import Histories, Tools, Users
from ToolApp.security import make_admin_token


class TapeMeasureReportTests(TestCase):
    def setUp(self):
        self.admin = Client()
        self.admin.cookies["ptj"] = make_admin_token()
        self.ana = Users.objects.create(UserName="Ana Pop", UserSerie="EMP-1")
        self.ion = Users.objects.create(UserName="Ion Ionescu", UserSerie="EMP-2")

        historical_tool = Tools.objects.create(ToolName="Ruletă Stanley 5m", ToolSerie="R-1", Pieces=1)
        Histories.objects.create(
            user_fk=self.ana,
            tool_fk=historical_tool,
            direction=Histories.Movement.OUT,
            quantity=1,
            timestamp=timezone.make_aware(datetime.combine(date(2025, 2, 3), time(8, 30))),
            DateOfGiving=date(2025, 2, 3),
        )
        Histories.objects.create(
            user_fk=self.ana,
            tool_fk=historical_tool,
            direction=Histories.Movement.IN,
            quantity=1,
            timestamp=timezone.make_aware(datetime.combine(date(2025, 2, 5), time(17, 0))),
            DateOfGiving=date(2025, 2, 5),
        )

        self.initial_tool = Tools.objects.create(
            ToolName="RULETA 10M",
            ToolSerie="R-2",
            AssignedTo=self.ion,
            User=self.ion.UserName,
            Pieces=2,
            DateOfGiving=date(2026, 1, 10),
            Status=Tools.ToolStatus.IN_LUCRU,
            IsReturned=False,
        )
        Tools.objects.create(
            ToolName="Bormașină",
            ToolSerie="B-1",
            AssignedTo=self.ion,
            Pieces=1,
            DateOfGiving=date(2026, 1, 10),
            Status=Tools.ToolStatus.IN_LUCRU,
        )

    def test_admin_report_combines_history_and_initial_allocations(self):
        response = self.admin.get("/api/warehouse/tape-measures/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["events"], 2)
        self.assertEqual(payload["summary"]["recipients"], 2)
        self.assertEqual(payload["summary"]["quantity"], 3.0)
        self.assertEqual({row["recipient_name"] for row in payload["rows"]}, {"Ana Pop", "Ion Ionescu"})
        self.assertEqual(
            {row["source"] for row in payload["rows"]},
            {"Istoric mișcări", "Alocare inițială importată"},
        )

    def test_report_filters_by_effective_receipt_date(self):
        response = self.admin.get(
            "/api/warehouse/tape-measures/?start_date=2026-01-01&end_date=2026-12-31"
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["events"], 1)
        self.assertEqual(payload["rows"][0]["recipient_name"], "Ion Ionescu")

    def test_history_is_not_duplicated_by_current_tool_state(self):
        self.initial_tool.ToolName = "Ruletă cu istoric"
        self.initial_tool.save(update_fields=["ToolName"])
        Histories.objects.create(
            user_fk=self.ion,
            tool_fk=self.initial_tool,
            direction=Histories.Movement.OUT,
            quantity=2,
            DateOfGiving=date(2026, 1, 10),
        )
        response = self.admin.get("/api/warehouse/tape-measures/")
        rows_for_tool = [row for row in response.json()["rows"] if row["tool_series"] == "R-2"]
        self.assertEqual(len(rows_for_tool), 1)
        self.assertEqual(rows_for_tool[0]["source"], "Istoric mișcări")

    def test_excel_export_contains_typed_rows(self):
        response = self.admin.get("/api/warehouse/tape-measures/excel/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("spreadsheetml", response["Content-Type"])
        workbook = load_workbook(io.BytesIO(response.content), data_only=False)
        sheet = workbook["Rulete predate"]
        self.assertEqual(sheet["A1"].value, "Cine a primit rulete")
        self.assertEqual(sheet["A6"].value, "Persoană")
        self.assertEqual(sheet["G6"].value, "Data primirii")
        self.assertIsInstance(sheet["G7"].value, datetime)
        self.assertEqual(sheet.freeze_panes, "A7")

    def test_report_requires_admin(self):
        response = self.client.get("/api/warehouse/tape-measures/")
        self.assertEqual(response.status_code, 401)
