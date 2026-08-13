import json
from datetime import date

from django.test import TestCase

from ToolApp.models import EmployeeTeam, EmployeeTeamMember, Histories, Tools, Users
from ToolApp.security import make_admin_token


class ToolEditingApiTests(TestCase):
    def test_updates_tool_from_unelte_editor_payload(self):
        employee = Users.objects.create(UserName="Ion Pop", UserSerie="EMP-1")
        tool = Tools.objects.create(
            ToolName="Bormasina veche",
            ToolSerie="TOOL-1",
            Pieces=1,
            Status=Tools.ToolStatus.FUNCTIONALA,
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
        self.assertEqual(tool.Status, Tools.ToolStatus.FUNCTIONALA)

    def test_tool_statuses_are_standardized(self):
        self.assertEqual(
            {value for value, _ in Tools.ToolStatus.choices},
            {"functionala", "nefunctionala", "in_lucru"},
        )

    def test_tool_response_includes_assigned_employee_team(self):
        leader = Users.objects.create(UserName="Maria Lider", UserSerie="LEAD-1")
        employee = Users.objects.create(UserName="Ion Echipa", UserSerie="TEAM-1")
        team = EmployeeTeam.objects.create(name="Echipa Y", leader=leader)
        EmployeeTeamMember.objects.create(team=team, employee=employee)
        tool = Tools.objects.create(
            ToolName="Scula X",
            AssignedTo=employee,
            User=employee.UserName,
            Status=Tools.ToolStatus.IN_LUCRU,
            MainLocation=employee.UserName,
        )

        response = self.client.get(
            f"/api/tool/{tool.ToolId}",
            HTTP_AUTHORIZATION=f"Bearer {make_admin_token()}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["AssignedTeamId"], team.id)
        self.assertEqual(response.json()["AssignedTeamName"], "Echipa Y")

    def test_assign_and_return_flow_uses_standardized_statuses(self):
        employee = Users.objects.create(UserName="Muncitor Flux", UserSerie="FLOW-1")
        warehouse_tool = Tools.objects.create(
            ToolName="Ciocan rotopercutor",
            Pieces=3,
            Status=Tools.ToolStatus.FUNCTIONALA,
            MainLocation="Magazie",
            ExpiryDate=date(2030, 12, 31),
        )
        authorization = f"Bearer {make_admin_token()}"

        assign_response = self.client.post(
            "/api/tools/assign-quantity/",
            data=json.dumps({
                "ToolId": warehouse_tool.ToolId,
                "AssignedUserId": employee.UserId,
                "Pieces": 1,
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=authorization,
        )

        self.assertEqual(assign_response.status_code, 200)
        self.assertEqual(assign_response.json()["warehouse"]["Status"], "functionala")
        self.assertEqual(assign_response.json()["assigned"]["Status"], "in_lucru")
        self.assertEqual(assign_response.json()["assigned"]["ExpiryDate"], "2030-12-31")

        assigned_tool_id = assign_response.json()["assigned"]["ToolId"]
        return_response = self.client.post(
            "/api/tools/return-quantity/",
            data=json.dumps({
                "ToolId": assigned_tool_id,
                "Pieces": 1,
                "Status": "nefunctionala",
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=authorization,
        )

        self.assertEqual(return_response.status_code, 200)
        self.assertEqual(return_response.json()["warehouse"]["Status"], "nefunctionala")

    def test_collaborator_can_receive_and_return_tools_with_person_type_in_api(self):
        collaborator = Users.objects.create(
            UserName="Firma Colaboratoare",
            UserSerie="COL-1",
            person_type=Users.PersonType.COLLABORATOR,
        )
        warehouse_tool = Tools.objects.create(
            ToolName="Masina de gaurit",
            Pieces=2,
            Status=Tools.ToolStatus.FUNCTIONALA,
            MainLocation="Magazie",
        )
        authorization = f"Bearer {make_admin_token()}"

        assign_response = self.client.post(
            "/api/tools/assign-quantity/",
            data=json.dumps({
                "ToolId": warehouse_tool.ToolId,
                "AssignedUserId": collaborator.UserId,
                "Pieces": 1,
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=authorization,
        )

        self.assertEqual(assign_response.status_code, 200)
        assigned = assign_response.json()["assigned"]
        self.assertEqual(assigned["AssignedPersonType"], "collaborator")
        self.assertEqual(assigned["AssignedPersonTypeLabel"], "Colaborator")
        self.assertIsNone(assigned["AssignedTeamId"])

        return_response = self.client.post(
            "/api/tools/return-quantity/",
            data=json.dumps({"ToolId": assigned["ToolId"], "Pieces": 1}),
            content_type="application/json",
            HTTP_AUTHORIZATION=authorization,
        )
        self.assertEqual(return_response.status_code, 200)

    def test_history_payload_identifies_collaborator(self):
        collaborator = Users.objects.create(
            UserName="Colaborator Istoric",
            UserSerie="COL-H",
            person_type=Users.PersonType.COLLABORATOR,
        )
        tool = Tools.objects.create(ToolName="Flex", Pieces=1)
        history = Histories.objects.create(
            user_fk=collaborator,
            tool_fk=tool,
            direction=Histories.Movement.OUT,
        )

        response = self.client.get(
            "/api/history/",
            HTTP_AUTHORIZATION=f"Bearer {make_admin_token()}",
        )

        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.json() if item["HistoryId"] == history.HistoryId)
        self.assertEqual(row["user"]["person_type"], "collaborator")
        self.assertEqual(row["user"]["person_type_label"], "Colaborator")
