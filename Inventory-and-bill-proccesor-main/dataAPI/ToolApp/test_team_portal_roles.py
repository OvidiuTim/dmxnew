import json
from datetime import date
from unittest.mock import patch

from django.http import JsonResponse
from django.test import Client, TestCase

from ToolApp.leave_email import SUPERVISOR_PERSONAL_LEAVE_EMAIL, leave_request_recipients
from ToolApp.models import (
    AppUser,
    EmployeeTeam,
    EmployeeTeamMember,
    LeaveRequest,
    PortalTeamTransferRequest,
    TeamPortalNotification,
    Users,
)
from ToolApp.security import make_app_user_token


def make_employee(name, serie, pin):
    person = Users(UserName=name, UserSerie=serie, person_type=Users.PersonType.EMPLOYEE)
    person.set_pin(pin)
    person.save()
    account = AppUser.objects.filter(employee=person).first()
    if not account:
        account = AppUser(employee=person, username=serie.lower())
        account.set_pin(pin)
        account.save()
    return person, account


def client_for(account):
    client = Client()
    client.cookies["appj"] = make_app_user_token(account)
    return client


class TeamPortalRoleSecurityTests(TestCase):
    def setUp(self):
        self.plain, self.plain_account = make_employee("Angajat Simplu", "PORTAL-P", "4101")
        self.leader, self.leader_account = make_employee("Șef Echipă", "PORTAL-L", "4102")
        self.supervisor, self.supervisor_account = make_employee("Supervisor", "PORTAL-S", "4103")
        self.other_supervisor, self.other_supervisor_account = make_employee("Alt Supervisor", "PORTAL-OS", "4104")
        self.member, self.member_account = make_employee("Membru", "PORTAL-M", "4105")
        self.unassigned, self.unassigned_account = make_employee("Neatribuit", "PORTAL-U", "4106")
        self.source_member, self.source_member_account = make_employee("Membru Sursă", "PORTAL-SM", "4107")

        self.destination = EmployeeTeam.objects.create(
            name="Destinație",
            leader=self.leader,
            supervisor=self.supervisor,
            default_worksite="diverse",
        )
        self.source_leader, self.source_leader_account = make_employee("Șef Sursă", "PORTAL-SL", "4108")
        self.source = EmployeeTeam.objects.create(
            name="Sursă",
            leader=self.source_leader,
            supervisor=self.other_supervisor,
            default_worksite="diverse",
        )
        EmployeeTeamMember.objects.create(team=self.destination, employee=self.member)
        EmployeeTeamMember.objects.create(team=self.source, employee=self.source_member)

    def test_plain_employee_gets_only_own_portal_endpoints(self):
        client = client_for(self.plain_account)
        dashboard = client.get("/api/team-portal/dashboard/")
        salary = client.get("/api/team-portal/salary/")
        self.assertEqual(dashboard.status_code, 200, dashboard.content)
        self.assertEqual(dashboard.json()["roles"], [])
        self.assertEqual(salary.status_code, 200, salary.content)
        self.assertEqual(salary.json()["employee"]["id"], self.plain.pk)
        for field in ("leave_balance", "total_salary_ron", "meal_vouchers_ron", "salary_advance_ron", "salary_remainder_ron", "tools"):
            self.assertIn(field, salary.json())
        for endpoint in (
            "/api/team-portal/teams/",
            "/api/team-portal/supervised-teams/",
            "/api/team-portal/personnel/",
            "/api/team-portal/requests/",
            "/api/team-portal/missing-today/",
            "/api/team-portal/absent-today/",
        ):
            with self.subTest(endpoint=endpoint):
                self.assertEqual(client.get(endpoint).status_code, 403)

    def test_dismissed_employee_token_is_rejected(self):
        self.plain.employment_status = Users.EmploymentStatus.DISMISSED
        self.plain.active = False
        self.plain.save(update_fields=("employment_status", "active"))
        response = client_for(self.plain_account).get("/api/team-portal/dashboard/")
        self.assertEqual(response.status_code, 401)
        login = Client().post(
            "/api/app-auth/login/",
            data=json.dumps({"username": self.plain_account.username, "pin": "4101"}),
            content_type="application/json",
        )
        self.assertEqual(login.status_code, 401)

    def test_own_attendance_ignores_a_forged_employee_identity(self):
        captured = {}

        def fake_scan(request):
            captured.update(json.loads(request.body))
            return JsonResponse({"ok": True})

        with patch("ToolApp.team_portal_views.nfc_scan", side_effect=fake_scan):
            response = client_for(self.plain_account).post(
                "/api/team-portal/attendance/",
                data=json.dumps({
                    "employee_id": self.source_member.pk,
                    "content": self.source_member.UserPin,
                    "data_processing_consent": True,
                    "attendance_photo": "data:image/jpeg;base64,AA==",
                }),
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(captured["content"], self.plain.UserPin)
        self.assertEqual(captured["device_key"], f"team-portal-{self.plain_account.pk}")

    def test_combined_leader_and_supervisor_roles_are_both_exposed(self):
        self.destination.supervisor = self.leader
        self.destination.save(update_fields=("supervisor",))
        payload = client_for(self.leader_account).get("/api/team-portal/dashboard/").json()
        self.assertTrue(payload["is_team_leader"])
        self.assertTrue(payload["is_supervisor"])

    def test_supervisor_only_sees_supervised_teams_but_personnel_is_company_wide(self):
        client = client_for(self.supervisor_account)
        teams = client.get("/api/team-portal/supervised-teams/").json()["teams"]
        self.assertEqual({team["id"] for team in teams}, {self.destination.pk})
        people = client.get("/api/team-portal/personnel/").json()["employees"]
        self.assertIn(self.source_member.pk, {person["id"] for person in people})
        self.assertEqual(client.get("/api/team-portal/teams/").status_code, 403)

    def test_supervisor_directly_adds_an_unassigned_employee(self):
        response = client_for(self.supervisor_account).post(
            "/api/team-portal/transfer-requests/",
            data=json.dumps({"employee_id": self.unassigned.pk, "destination_team_id": self.destination.pk}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(response.json()["assigned"])
        self.assertTrue(EmployeeTeamMember.objects.filter(
            employee=self.unassigned, team=self.destination, active=True
        ).exists())

    def test_leader_request_for_unassigned_employee_needs_destination_supervisor(self):
        created = client_for(self.leader_account).post(
            "/api/team-portal/transfer-requests/",
            data=json.dumps({"employee_id": self.unassigned.pk, "destination_team_id": self.destination.pk}),
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        item = PortalTeamTransferRequest.objects.get(pk=created.json()["request"]["id"])
        self.assertEqual(item.destination_approval, item.ApprovalStatus.PENDING)
        self.assertFalse(EmployeeTeamMember.objects.filter(employee=self.unassigned, active=True).exists())
        approved = client_for(self.supervisor_account).post(
            f"/api/team-portal/transfer-requests/{item.pk}/decision/",
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertEqual(approved.status_code, 200, approved.content)
        self.assertTrue(approved.json()["transferred"])
        self.assertTrue(EmployeeTeamMember.objects.filter(employee=self.unassigned, team=self.destination, active=True).exists())

    def test_leader_transfer_between_teams_requires_both_supervisors(self):
        created = client_for(self.leader_account).post(
            "/api/team-portal/transfer-requests/",
            data=json.dumps({"employee_id": self.source_member.pk, "destination_team_id": self.destination.pk}),
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        item = PortalTeamTransferRequest.objects.get(pk=created.json()["request"]["id"])
        self.assertEqual(item.source_approval, item.ApprovalStatus.PENDING)
        self.assertEqual(item.destination_approval, item.ApprovalStatus.PENDING)
        first = client_for(self.other_supervisor_account).post(
            f"/api/team-portal/transfer-requests/{item.pk}/decision/",
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertFalse(first.json()["transferred"])
        second = client_for(self.supervisor_account).post(
            f"/api/team-portal/transfer-requests/{item.pk}/decision/",
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertTrue(second.json()["transferred"])
        self.assertTrue(EmployeeTeamMember.objects.filter(employee=self.source_member, team=self.destination, active=True).exists())
        self.assertFalse(EmployeeTeamMember.objects.filter(employee=self.source_member, team=self.source, active=True).exists())

    def test_concurrent_active_transfer_is_rejected(self):
        first = client_for(self.leader_account).post(
            "/api/team-portal/transfer-requests/",
            data=json.dumps({"employee_id": self.source_member.pk, "destination_team_id": self.destination.pk}),
            content_type="application/json",
        )
        self.assertEqual(first.status_code, 201)
        second = client_for(self.leader_account).post(
            "/api/team-portal/transfer-requests/",
            data=json.dumps({"employee_id": self.source_member.pk, "destination_team_id": self.destination.pk}),
            content_type="application/json",
        )
        self.assertEqual(second.status_code, 409)

    def test_transfer_is_rejected_when_a_required_supervisor_is_missing(self):
        leader, leader_account = make_employee("Șef Fără Supervisor", "PORTAL-NLS", "4199")
        no_supervisor = EmployeeTeam.objects.create(
            name="Fără supervisor",
            leader=leader,
            default_worksite="diverse",
        )
        response = client_for(leader_account).post(
            "/api/team-portal/transfer-requests/",
            data=json.dumps({"employee_id": self.unassigned.pk, "destination_team_id": no_supervisor.pk}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 409)
        self.assertIn("supervisor", response.json()["error"].lower())

    def test_non_supervisor_cannot_decide_a_transfer(self):
        created = client_for(self.leader_account).post(
            "/api/team-portal/transfer-requests/",
            data=json.dumps({"employee_id": self.unassigned.pk, "destination_team_id": self.destination.pk}),
            content_type="application/json",
        )
        request_id = created.json()["request"]["id"]
        denied = client_for(self.plain_account).post(
            f"/api/team-portal/transfer-requests/{request_id}/decision/",
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertEqual(denied.status_code, 403)

    def test_leave_request_goes_to_supervisor_and_cannot_be_self_approved(self):
        created = client_for(self.member_account).post(
            "/api/team-portal/leave-requests/",
            data=json.dumps({
                "leave_type": "paid_leave",
                "start_date": "2026-10-05",
                "end_date": "2026-10-06",
                "reason": "test",
            }),
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        item = LeaveRequest.objects.get(pk=created.json()["leave_request"]["id"])
        self.assertEqual(item.assigned_leader, self.supervisor)
        denied = client_for(self.member_account).post(
            f"/api/team-portal/leave-requests/{item.pk}/decision/",
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertEqual(denied.status_code, 403)
        approved = client_for(self.supervisor_account).post(
            f"/api/team-portal/leave-requests/{item.pk}/decision/",
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertEqual(approved.status_code, 200, approved.content)
        item.refresh_from_db()
        self.assertEqual(item.status, LeaveRequest.Status.APPROVED)
        self.assertIsNone(item.employee_seen_at)

    def test_leave_approval_notification_is_persistent_scoped_and_readable(self):
        created = client_for(self.member_account).post(
            "/api/team-portal/leave-requests/",
            data=json.dumps({
                "leave_type": "paid_leave",
                "start_date": "2026-10-12",
                "end_date": "2026-10-14",
            }),
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        item_id = created.json()["leave_request"]["id"]
        notice = TeamPortalNotification.objects.get(
            recipient=self.supervisor_account,
            kind=TeamPortalNotification.Kind.LEAVE_APPROVAL,
            leave_request_id=item_id,
        )
        self.assertFalse(TeamPortalNotification.objects.filter(recipient=self.other_supervisor_account, leave_request_id=item_id).exists())

        listing = client_for(self.supervisor_account).get("/api/team-portal/notifications/")
        payload = next(row for row in listing.json()["notifications"] if row["kind"] == "leave_approval")
        self.assertEqual(payload["request_id"], item_id)
        self.assertEqual(payload["target_path"], f"/team-dashboard/cereri-concediu?request={item_id}")

        marked = client_for(self.supervisor_account).post(
            "/api/team-portal/notifications/",
            data=json.dumps({"notification_ids": [notice.pk], "notification_kind": "leave_approval"}),
            content_type="application/json",
        )
        self.assertEqual(marked.status_code, 200, marked.content)
        notice.refresh_from_db()
        self.assertIsNotNone(notice.read_at)

        # Cererea de aprobat rămâne în listă cât timp este în așteptare,
        # chiar dacă notificarea a fost deja deschisă.
        still_listed = client_for(self.supervisor_account).get("/api/team-portal/notifications/").json()
        self.assertIn(item_id, [
            row.get("request_id") for row in still_listed["notifications"] if row["kind"] == "leave_approval"
        ])

        decided = client_for(self.supervisor_account).post(
            f"/api/team-portal/leave-requests/{item_id}/decision/",
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertEqual(decided.status_code, 200, decided.content)
        after_decision = client_for(self.supervisor_account).get("/api/team-portal/notifications/").json()
        self.assertEqual(
            [row for row in after_decision["notifications"] if row["kind"] == "leave_approval"],
            [],
        )

    def test_pending_request_without_stored_notification_is_still_flagged(self):
        """O cerere creată pe alt drum (mobil, administrare) trebuie să apară totuși.

        Reproduce cazul real: cererea era în așteptare la supervisor, dar nu
        exista niciun rând TeamPortalNotification, deci nu se vedea nimic.
        """
        item = LeaveRequest.objects.create(
            employee=self.member,
            team=self.destination,
            leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
            start_date=date(2026, 11, 2),
            end_date=date(2026, 11, 6),
        )
        # Cererile vechi, dinainte de introducerea notificărilor, nu au rând salvat.
        TeamPortalNotification.objects.filter(leave_request=item).delete()
        self.assertFalse(TeamPortalNotification.objects.filter(leave_request=item).exists())

        listing = client_for(self.supervisor_account).get("/api/team-portal/notifications/").json()
        payload = next(row for row in listing["notifications"] if row.get("request_id") == item.pk)
        self.assertTrue(payload["urgent"])
        self.assertFalse(payload["is_read"])
        self.assertEqual(payload["target_path"], f"/team-dashboard/cereri-concediu?request={item.pk}")
        self.assertEqual(listing["unread_count"], 1)

        # Rămâne roșie și la reîncărcare, fiindcă nu a primit încă un răspuns.
        again = client_for(self.supervisor_account).get("/api/team-portal/notifications/").json()
        self.assertIn(item.pk, [row.get("request_id") for row in again["notifications"]])

        # Supervisorul nu vede cererile altor echipe.
        other = client_for(self.other_supervisor_account).get("/api/team-portal/notifications/").json()
        self.assertNotIn(item.pk, [row.get("request_id") for row in other["notifications"]])

        decided = client_for(self.supervisor_account).post(
            f"/api/team-portal/leave-requests/{item.pk}/decision/",
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertEqual(decided.status_code, 200, decided.content)
        after = client_for(self.supervisor_account).get("/api/team-portal/notifications/").json()
        self.assertNotIn(item.pk, [row.get("request_id") for row in after["notifications"]])

    def test_transfer_notifies_only_the_current_approval_stage(self):
        created = client_for(self.leader_account).post(
            "/api/team-portal/transfer-requests/",
            data=json.dumps({"employee_id": self.source_member.pk, "destination_team_id": self.destination.pk}),
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        item_id = created.json()["request"]["id"]
        self.assertTrue(TeamPortalNotification.objects.filter(
            recipient=self.other_supervisor_account,
            transfer_request_id=item_id,
            dedupe_key__endswith=":source",
        ).exists())
        self.assertFalse(TeamPortalNotification.objects.filter(
            recipient=self.supervisor_account,
            transfer_request_id=item_id,
            kind=TeamPortalNotification.Kind.TRANSFER_APPROVAL,
        ).exists())

        first = client_for(self.other_supervisor_account).post(
            f"/api/team-portal/transfer-requests/{item_id}/decision/",
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertEqual(first.status_code, 200, first.content)
        self.assertTrue(TeamPortalNotification.objects.filter(
            recipient=self.supervisor_account,
            transfer_request_id=item_id,
            dedupe_key__endswith=":destination",
        ).exists())

    def test_request_lists_are_separate_and_permission_scoped(self):
        LeaveRequest.objects.create(
            employee=self.member,
            team=self.destination,
            assigned_leader=self.supervisor,
            leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
            start_date="2026-12-14",
            end_date="2026-12-15",
        )
        supervisor_client = client_for(self.supervisor_account)
        self.assertEqual(supervisor_client.get("/api/team-portal/requests/leaves/").status_code, 200)
        self.assertEqual(supervisor_client.get("/api/team-portal/requests/transfers/").status_code, 200)
        self.assertEqual(supervisor_client.get("/api/team-portal/requests/summary/").json()["leave_pending_count"], 1)
        self.assertEqual(client_for(self.other_supervisor_account).get("/api/team-portal/requests/leaves/").json()["requests"], [])
        self.assertEqual(client_for(self.plain_account).get("/api/team-portal/requests/leaves/").status_code, 403)

    def test_supervisor_personal_leave_email_includes_dan(self):
        item = LeaveRequest.objects.create(
            employee=self.supervisor,
            team=self.destination,
            assigned_leader=self.supervisor,
            leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
            start_date="2026-11-02",
            end_date="2026-11-03",
        )
        self.assertIn(SUPERVISOR_PERSONAL_LEAVE_EMAIL, leave_request_recipients(item))

    def test_supervisor_cannot_decide_leave_outside_supervised_teams(self):
        item = LeaveRequest.objects.create(
            employee=self.member,
            team=self.destination,
            assigned_leader=self.supervisor,
            leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
            start_date="2026-12-07",
            end_date="2026-12-08",
        )
        denied = client_for(self.other_supervisor_account).post(
            f"/api/team-portal/leave-requests/{item.pk}/decision/",
            data=json.dumps({"action": "approve"}),
            content_type="application/json",
        )
        self.assertEqual(denied.status_code, 404)
