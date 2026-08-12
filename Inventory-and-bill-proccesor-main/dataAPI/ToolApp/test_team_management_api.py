import json
from datetime import timedelta
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from ToolApp.models import (
    AppUser,
    AttendanceSession,
    EmployeeTeam,
    EmployeeTeamMember,
    LeaveDay,
    TemporaryWorkerRequest,
    Users,
)
from ToolApp.security import make_admin_token, make_app_user_token


class TeamManagementApiTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.leader_a = self.employee("Lider A", "L-A", "Șef de echipă")
        self.leader_b = self.employee("Lider B", "L-B", "Șef de echipă")
        self.worker_a = self.employee("Muncitor A", "M-A", "Fierar")
        self.worker_b = self.employee("Muncitor B", "M-B", "Dulgher")
        self.worker_free = self.employee("Muncitor Liber", "M-F", "Zidar")
        self.admin = Client()
        self.admin.cookies["ptj"] = make_admin_token()

    def employee(self, name, serie, trade):
        return Users.objects.create(UserName=name, UserSerie=serie, trade=trade)

    def leader_client(self, employee, username):
        app_user = AppUser.objects.create(employee=employee, username=username, pin_hash="unused")
        client = Client()
        client.cookies["appj"] = make_app_user_token(app_user)
        return client, app_user

    def create_team(self, name, leader, members, active=True):
        response = self.admin.post(
            reverse("teams_collection"),
            data=json.dumps({
                "name": name,
                "leader_id": leader.pk,
                "default_worksite": "Șantier Nord",
                "active": active,
                "member_ids": [item.pk for item in members],
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        return EmployeeTeam.objects.get(pk=response.json()["team"]["id"])

    def test_create_team_with_leader_and_members(self):
        team = self.create_team("Echipa Alfa", self.leader_a, [self.worker_a, self.worker_b])
        self.assertEqual(team.leader, self.leader_a)
        self.assertEqual(team.default_worksite, "Șantier Nord")
        self.assertSetEqual(
            set(team.memberships.filter(active=True).values_list("employee_id", flat=True)),
            {self.leader_a.pk, self.worker_a.pk, self.worker_b.pk},
        )

    def test_create_team_saves_leader_email(self):
        response = self.admin.post(
            reverse("teams_collection"),
            data=json.dumps({
                "name": "Echipa Email",
                "leader_id": self.leader_a.pk,
                "leader_email": "lider.a@example.com",
                "active": True,
                "member_ids": [self.worker_a.pk],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        self.leader_a.refresh_from_db()
        self.assertEqual(self.leader_a.email, "lider.a@example.com")
        self.assertEqual(response.json()["team"]["leader"]["email"], "lider.a@example.com")

    def test_team_payload_contains_employee_photos_for_leader_and_members(self):
        self.leader_a.photo = "https://example.test/leader.jpg"
        self.leader_a.save(update_fields=["photo"])
        self.worker_a.photo = "data:image/png;base64,worker"
        self.worker_a.save(update_fields=["photo"])
        self.create_team("Echipa Foto", self.leader_a, [self.worker_a])

        response = self.admin.get(reverse("teams_collection"))

        self.assertEqual(response.status_code, 200, response.content)
        team = response.json()["teams"][0]
        self.assertEqual(team["leader"]["photo"], "https://example.test/leader.jpg")
        worker = next(member for member in team["members"] if member["id"] == self.worker_a.pk)
        self.assertEqual(worker["photo"], "data:image/png;base64,worker")

    def test_edit_team(self):
        team = self.create_team("Echipa Alfa", self.leader_a, [self.worker_a])
        response = self.admin.put(
            reverse("team_detail", args=[team.pk]),
            data=json.dumps({
                "name": "Echipa Alfa Nouă",
                "leader_id": self.leader_b.pk,
                "default_worksite": "Șantier Sud",
                "active": True,
                "member_ids": [self.worker_b.pk],
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        team.refresh_from_db()
        self.assertEqual(team.name, "Echipa Alfa Nouă")
        self.assertEqual(team.leader, self.leader_b)
        self.assertSetEqual(
            set(team.memberships.filter(active=True).values_list("employee_id", flat=True)),
            {self.leader_b.pk, self.worker_b.pk},
        )

    def test_employee_cannot_join_two_active_permanent_teams(self):
        self.create_team("Echipa Alfa", self.leader_a, [self.worker_a])
        response = self.admin.post(
            reverse("teams_collection"),
            data=json.dumps({
                "name": "Echipa Beta",
                "leader_id": self.leader_b.pk,
                "active": True,
                "member_ids": [self.worker_a.pk],
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("echipă permanentă", str(response.json()["details"]["member_ids"]))

    def test_leader_cannot_lead_two_active_teams(self):
        self.create_team("Echipa Alfa", self.leader_a, [self.worker_a])
        response = self.admin.post(
            reverse("teams_collection"),
            data=json.dumps({
                "name": "Echipa Beta",
                "leader_id": self.leader_a.pk,
                "active": True,
                "member_ids": [self.worker_b.pk],
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                EmployeeTeam.objects.create(name="Direct invalid", leader=self.leader_a)

    def test_leader_cannot_modify_another_team(self):
        self.create_team("Echipa Alfa", self.leader_a, [self.worker_a])
        team_b = self.create_team("Echipa Beta", self.leader_b, [self.worker_b])
        client, _ = self.leader_client(self.leader_a, "lider-a")
        response = client.patch(
            reverse("team_detail", args=[team_b.pk]),
            data=json.dumps({"member_ids": [self.worker_free.pk]}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)

    def test_leader_response_identifies_own_team_for_my_team_page(self):
        own_team = self.create_team("Echipa Alfa", self.leader_a, [self.worker_a])
        self.create_team("Echipa Beta", self.leader_b, [self.worker_b])
        client, _ = self.leader_client(self.leader_a, "lider-propriu")

        response = client.get(reverse("teams_collection"))

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["permissions"]["leader_team_ids"], [own_team.pk])

    def setup_transfer(self):
        team_a = self.create_team("Echipa Alfa", self.leader_a, [self.worker_a])
        team_b = self.create_team("Echipa Beta", self.leader_b, [self.worker_b])
        requester_client, requester_user = self.leader_client(self.leader_a, "lider-a")
        source_client, source_user = self.leader_client(self.leader_b, "lider-b")
        return team_a, team_b, requester_client, requester_user, source_client, source_user

    def create_request(self, client, requester_team, employee, start=None, end=None):
        response = client.post(
            reverse("temporary_worker_requests"),
            data=json.dumps({
                "requester_team_id": requester_team.pk,
                "employee_id": employee.pk,
                "start_date": str(start or self.today),
                "end_date": str(end or self.today),
                "reason": "Lucrare urgentă",
            }),
            content_type="application/json",
        )
        return response

    def test_request_and_approval_preserve_permanent_team(self):
        team_a, team_b, requester, _, source, _ = self.setup_transfer()
        response = self.create_request(requester, team_a, self.worker_b)
        self.assertEqual(response.status_code, 201, response.content)
        request_id = response.json()["request"]["id"]
        decision = source.post(
            reverse("temporary_worker_request_action", args=[request_id]),
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertEqual(decision.status_code, 200, decision.content)
        self.assertEqual(decision.json()["request"]["status"], "approved")
        self.assertTrue(EmployeeTeamMember.objects.filter(team=team_b, employee=self.worker_b, active=True).exists())

    def test_request_rejection(self):
        team_a, _, requester, _, source, _ = self.setup_transfer()
        response = self.create_request(requester, team_a, self.worker_b)
        decision = source.post(
            reverse("temporary_worker_request_action", args=[response.json()["request"]["id"]]),
            data=json.dumps({"action": "reject"}),
            content_type="application/json",
        )
        self.assertEqual(decision.status_code, 200)
        self.assertEqual(decision.json()["request"]["status"], "rejected")

    @patch("ToolApp.team_views.send_worker_request_email", return_value=True)
    def test_request_is_sent_to_source_leader_email(self, send_email):
        self.leader_b.email = "lider.b@example.com"
        self.leader_b.save(update_fields=("email",))
        team_a, _, requester, _, _, _ = self.setup_transfer()

        response = self.create_request(requester, team_a, self.worker_b)

        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(response.json()["email_sent"])
        item = TemporaryWorkerRequest.objects.get(pk=response.json()["request"]["id"])
        self.assertIsNotNone(item.email_sent_at)
        send_email.assert_called_once_with(item)

    def test_notifications_stay_active_until_seen_and_resolved(self):
        team_a, _, requester, _, source, _ = self.setup_transfer()
        created = self.create_request(requester, team_a, self.worker_b)
        self.assertEqual(created.status_code, 201, created.content)

        before = source.get(reverse("team_notifications_summary"))
        self.assertEqual(before.status_code, 200, before.content)
        self.assertEqual(before.json()["attention_count"], 1)

        opened = source.get(reverse("team_notifications"))
        self.assertEqual(opened.status_code, 200, opened.content)
        self.assertEqual(opened.json()["pending_count"], 1)
        item = TemporaryWorkerRequest.objects.get()
        self.assertIsNotNone(item.seen_at)
        self.assertEqual(source.get(reverse("team_notifications_summary")).json()["attention_count"], 1)

        decision = source.post(
            reverse("temporary_worker_request_action", args=[item.pk]),
            data=json.dumps({"action": "reject"}),
            content_type="application/json",
        )
        self.assertEqual(decision.status_code, 200, decision.content)
        self.assertEqual(source.get(reverse("team_notifications_summary")).json()["attention_count"], 0)

    def test_permanent_request_moves_employee_after_source_leader_approval(self):
        team_a, team_b, requester, _, source, _ = self.setup_transfer()
        created = requester.post(
            reverse("temporary_worker_requests"),
            data=json.dumps({
                "requester_team_id": team_a.pk,
                "employee_id": self.worker_b.pk,
                "request_type": "permanent",
                "reason": "Mutare definitivă",
            }),
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        request_id = created.json()["request"]["id"]
        self.assertEqual(created.json()["request"]["request_type"], "permanent")

        decision = source.post(
            reverse("temporary_worker_request_action", args=[request_id]),
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )

        self.assertEqual(decision.status_code, 200, decision.content)
        self.assertFalse(EmployeeTeamMember.objects.filter(team=team_b, employee=self.worker_b, active=True).exists())
        self.assertTrue(EmployeeTeamMember.objects.filter(team=team_a, employee=self.worker_b, active=True).exists())

    def test_request_cancellation(self):
        team_a, _, requester, _, _, _ = self.setup_transfer()
        response = self.create_request(requester, team_a, self.worker_b)
        cancelled = requester.post(
            reverse("temporary_worker_request_action", args=[response.json()["request"]["id"]]),
            data=json.dumps({"action": "cancel"}),
            content_type="application/json",
        )
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(cancelled.json()["request"]["status"], "cancelled")

    def test_overlapping_request_is_blocked(self):
        team_a, _, requester, _, _, _ = self.setup_transfer()
        first = self.create_request(requester, team_a, self.worker_b, self.today, self.today + timedelta(days=2))
        self.assertEqual(first.status_code, 201)
        overlap = self.create_request(requester, team_a, self.worker_b, self.today + timedelta(days=1), self.today + timedelta(days=3))
        self.assertEqual(overlap.status_code, 400)
        self.assertEqual(TemporaryWorkerRequest.objects.count(), 1)

    def test_employee_on_leave_cannot_be_requested(self):
        team_a, _, requester, _, _, _ = self.setup_transfer()
        LeaveDay.objects.create(user_fk=self.worker_b, work_date=self.today, reason=LeaveDay.Reason.CO)
        response = self.create_request(requester, team_a, self.worker_b)
        self.assertEqual(response.status_code, 400)

    def test_today_view_places_approved_worker_in_requester_team(self):
        team_a, team_b, requester, _, source, _ = self.setup_transfer()
        AttendanceSession.objects.create(user_fk=self.worker_b, work_date=self.today, worksite="Șantier Est")
        created = self.create_request(requester, team_a, self.worker_b)
        source.post(
            reverse("temporary_worker_request_action", args=[created.json()["request"]["id"]]),
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        response = requester.get(reverse("teams_today"), {"date": str(self.today)})
        self.assertEqual(response.status_code, 200, response.content)
        rows = {item["id"]: item for item in response.json()["teams"]}
        self.assertEqual(rows[team_a.pk]["received"][0]["id"], self.worker_b.pk)
        self.assertEqual(rows[team_b.pk]["sent"][0]["id"], self.worker_b.pk)

    def test_inactive_employee_cannot_be_added(self):
        team = self.create_team("Echipa Alfa", self.leader_a, [self.worker_a])
        self.worker_free.active = False
        self.worker_free.save(update_fields=["active"])
        response = self.admin.post(
            reverse("team_members", args=[team.pk]),
            data=json.dumps({"action": "add", "employee_id": self.worker_free.pk}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
