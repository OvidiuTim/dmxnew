import io
import json
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from ToolApp.models import EmployeeTeam, EmployeeTeamMember, OrganizationDepartment, OrganizationMember, Users
from ToolApp.organization_import import count_records, organization_records, parse_organization_html
from ToolApp.security import make_admin_token


SOURCE_HTML = """
<script>
const DATA = {"workers":[{"name":"Muncitor Test","team":"EXEC","role":"Zidar","photo":"worker","foreman":true,"conf":true}],"photos":{"lead":"TEVBRA==","worker":"V09SS0VS","external":"RVhURVJO"}};
const TEAMS = {EXEC:{label:'Execuție',sub:'Echipă execuție',color:'#15803d'}};
const C_SUPORT='#0e7490';
function P(name, role, photo, opts={}) { return {}; }
function team(t) { return {}; }
function dept(name, color, members, children, sub) { return {}; }
const TREE = {
  type:'duo', root:true, color:'#f5b301',
  persons:[P('Dragos Bucsa','Director','lead'), P('Membru Extern','Consultant','external')],
  children:[dept('Operațional', C_SUPORT, [], [team('EXEC')], 'Departament principal')]
};
</script>
"""


class OrganizationImportTests(TestCase):
    def test_parser_preserves_departments_members_and_photos(self):
        root = organization_records(parse_organization_html(SOURCE_HTML))
        self.assertEqual(count_records(root), {"departments": 3, "members": 3, "photos": 3})
        self.assertEqual(root["children"][0]["name"], "Operațional")
        team = root["children"][0]["children"][0]
        self.assertEqual(team["name"], "Execuție")
        self.assertEqual(team["members"][0]["role"], "Zidar")
        self.assertTrue(team["members"][0]["photo"].startswith("data:image/jpeg;base64,"))

    def test_command_previews_then_imports_and_never_overwrites_employee_photo(self):
        linked = Users.objects.create(UserName="Bucșa Dragoș - Rara", UserSerie="ORG-1")
        protected = Users.objects.create(
            UserName="Muncitor Test 123456", UserSerie="ORG-2", trade="Zidar",
            photo="data:image/webp;base64,EXISTENTA",
        )
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "organization.html"
            source.write_text(SOURCE_HTML, encoding="utf-8")
            preview = io.StringIO()
            call_command("import_organization_chart", str(source), stdout=preview)
            self.assertFalse(OrganizationDepartment.objects.exists())
            self.assertIn("Nu s-a modificat baza de date", preview.getvalue())

            call_command("import_organization_chart", str(source), apply=True, stdout=io.StringIO())

        self.assertEqual(OrganizationDepartment.objects.count(), 3)
        self.assertEqual(OrganizationMember.objects.count(), 3)
        linked.refresh_from_db()
        protected.refresh_from_db()
        self.assertTrue(linked.photo.startswith("data:image/jpeg;base64,"))
        self.assertEqual(protected.photo, "data:image/webp;base64,EXISTENTA")
        self.assertEqual(OrganizationMember.objects.get(employee=linked).name, "Dragos Bucsa")
        self.assertEqual(OrganizationMember.objects.get(employee=protected).name, "Muncitor Test")
        self.assertTrue(OrganizationMember.objects.filter(name="Membru Extern", employee__isnull=True).exists())


class OrganizationApiTests(TestCase):
    def setUp(self):
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {make_admin_token()}"}
        self.first = OrganizationDepartment.objects.create(name="Primul", sort_order=0)
        self.second = OrganizationDepartment.objects.create(name="Al doilea", sort_order=1)
        self.employee = Users.objects.create(UserName="Angajat asociat", UserSerie="ORG-API-1")

    def test_add_move_and_associate_member(self):
        created = self.client.post(
            "/api/organization/",
            data=json.dumps({
                "name": "Membru nou", "role": "Inginer", "department_id": self.first.id,
                "employee_id": self.employee.UserId,
            }),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(created.status_code, 201, created.content)
        member_id = created.json()["member"]["id"]

        moved = self.client.patch(
            f"/api/organization/members/{member_id}/",
            data=json.dumps({"department_id": self.second.id, "role": "Manager de proiect"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(moved.status_code, 200, moved.content)
        member = OrganizationMember.objects.get(pk=member_id)
        self.assertEqual(member.department, self.second)
        self.assertEqual(member.role, "Manager de proiect")
        self.assertEqual(member.employee, self.employee)

        payload = self.client.get("/api/organization/", **self.auth).json()
        self.assertEqual(payload["summary"]["members"], 1)
        self.assertEqual(payload["summary"]["associated"], 1)
        self.assertEqual(payload["members"][0]["employee"]["id"], self.employee.UserId)

    def test_department_can_be_transformed_into_permanent_team(self):
        supervisor = Users.objects.create(UserName="Supervisor", UserSerie="ORG-SUP")
        OrganizationMember.objects.create(name=self.employee.UserName, department=self.first, employee=self.employee)
        OrganizationMember.objects.create(name=supervisor.UserName, department=self.first, employee=supervisor)

        response = self.client.post(
            f"/api/organization/departments/{self.first.pk}/team/",
            data=json.dumps({"leader_id": self.employee.pk, "supervisor_id": supervisor.pk}),
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.first.refresh_from_db()
        self.assertIsNotNone(self.first.team_id)
        team = EmployeeTeam.objects.get(pk=self.first.team_id)
        self.assertEqual(team.leader, self.employee)
        self.assertEqual(team.supervisor, supervisor)
        self.assertSetEqual(
            set(EmployeeTeamMember.objects.filter(team=team, active=True).values_list("employee_id", flat=True)),
            {self.employee.pk, supervisor.pk},
        )
        payload = response.json()["organization"]
        linked = next(item for item in payload["departments"] if item["id"] == self.first.pk)
        self.assertEqual(linked["team"]["id"], team.pk)

    def test_moving_regular_member_out_of_linked_group_updates_team(self):
        leader = Users.objects.create(UserName="Lider sincronizat", UserSerie="ORG-LEAD")
        leader_member = OrganizationMember.objects.create(name=leader.UserName, department=self.first, employee=leader)
        worker_member = OrganizationMember.objects.create(name=self.employee.UserName, department=self.first, employee=self.employee)
        team = EmployeeTeam.objects.create(name="Echipa sincronizată", leader=leader, supervisor=leader)
        self.first.team = team
        self.first.save(update_fields=("team", "updated_at"))
        EmployeeTeamMember.objects.create(team=team, employee=leader)
        EmployeeTeamMember.objects.create(team=team, employee=self.employee)

        moved = self.client.patch(
            f"/api/organization/members/{worker_member.pk}/",
            data=json.dumps({"department_id": self.second.pk}),
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(moved.status_code, 200, moved.content)
        self.assertFalse(EmployeeTeamMember.objects.get(team=team, employee=self.employee).active)
        self.assertTrue(EmployeeTeamMember.objects.get(team=team, employee=leader).active)
        leader_member.refresh_from_db()
        self.assertEqual(leader_member.role, "Șef de echipă · Supervisor")
