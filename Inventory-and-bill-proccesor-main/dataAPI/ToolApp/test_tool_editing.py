import json

from django.test import TestCase

from ToolApp.models import Tools, Users
from ToolApp.security import make_admin_token


class ToolEditingApiTests(TestCase):
    def test_updates_tool_from_unelte_editor_payload(self):
        employee = Users.objects.create(UserName="Ion Pop", UserSerie="EMP-1")
        tool = Tools.objects.create(
            ToolName="Bormasina veche",
            ToolSerie="TOOL-1",
            Pieces=1,
            Status=Tools.ToolStatus.MAGAZIE,
            MainLocation="Magazie",
        )

        response = self.client.put(
            "/api/tool/",
            data=json.dumps(
                {
                    "ToolId": tool.ToolId,
                    "ToolName": "Bormasina editata",
                    "ToolSerie": "TOOL-1",
                    "Pieces": 2,
                    "Status": "in_lucru",
                    "Location": "Santier A",
                    "AssignedUserId": employee.UserId,
                    "IsSSM": False,
                    "IsReturned": False,
                    "IsLost": False,
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {make_admin_token()}",
        )

        self.assertEqual(response.status_code, 200)
        tool.refresh_from_db()
        self.assertEqual(tool.ToolName, "Bormasina editata")
        self.assertEqual(tool.Pieces, 2)
        self.assertEqual(tool.Status, Tools.ToolStatus.IN_LUCRU)
        self.assertEqual(tool.MainLocation, "Santier A")
        self.assertEqual(tool.AssignedTo, employee)
        self.assertEqual(tool.User, "Ion Pop")

    def test_clears_legacy_employee_when_assignment_is_removed(self):
        employee = Users.objects.create(UserName="Ion Pop", UserSerie="EMP-2")
        tool = Tools.objects.create(
            ToolName="Polizor",
            ToolSerie="TOOL-2",
            User=employee.UserName,
            AssignedTo=employee,
            Pieces=1,
        )

        response = self.client.put(
            "/api/tool/",
            data=json.dumps({"ToolId": tool.ToolId, "AssignedUserId": None}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {make_admin_token()}",
        )

        self.assertEqual(response.status_code, 200)
        tool.refresh_from_db()
        self.assertIsNone(tool.AssignedTo)
        self.assertIsNone(tool.User)
