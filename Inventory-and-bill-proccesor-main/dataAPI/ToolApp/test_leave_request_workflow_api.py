import json
from datetime import date
from unittest.mock import patch

from django.test import Client, TestCase
from django.urls import reverse

from ToolApp.models import AppUser, EmployeeTeam, EmployeeTeamMember, LeaveDay, LeaveRequest, Users
from ToolApp.security import make_admin_token, make_app_user_token
from ToolApp.leave_email import LEAVE_REQUEST_OFFICE_EMAIL, leave_request_recipients


class LeaveRequestWorkflowApiTests(TestCase):
    def setUp(self):
        self.leader_a = self.employee("Lider A", "LR-LA", "Șef de echipă")
        self.leader_b = self.employee("Lider B", "LR-LB", "Șef de echipă")
        self.worker_a = self.employee("Muncitor A", "LR-WA", "Instalator", pin="5101")
        self.worker_b = self.employee("Muncitor B", "LR-WB", "Dulgher", pin="5102")
        self.worker_free = self.employee("Fără Echipă", "LR-WF", "Zidar", pin="5103")
        self.team_a = self.team("Echipa A", self.leader_a, self.worker_a)
        self.team_b = self.team("Echipa B", self.leader_b, self.worker_b)
        self.client_a, self.app_user_a = self.app_client(self.leader_a, "leave-leader-a")
        self.client_b, self.app_user_b = self.app_client(self.leader_b, "leave-leader-b")
        self.admin = Client()
        self.admin.cookies["ptj"] = make_admin_token()

    def employee(self, name, serie, trade, pin=""):
        return Users.objects.create(
            UserName=name,
            UserSerie=serie,
            UserPin=pin,
            trade=trade,
            hire_date=date(2024, 1, 1),
        )

    def team(self, name, leader, worker):
        team = EmployeeTeam.objects.create(name=name, leader=leader)
        EmployeeTeamMember.objects.create(team=team, employee=leader)
        EmployeeTeamMember.objects.create(team=team, employee=worker)
        return team

    def app_client(self, employee, username):
        app_user = AppUser.objects.create(employee=employee, username=username, pin_hash="unused")
        client = Client()
        client.cookies["appj"] = make_app_user_token(app_user)
        return client, app_user

    def mobile_create(
        self,
        pin,
        start="2026-09-01",
        end="2026-09-03",
        leave_type="unpaid_leave",
        reason="Programare personală",
    ):
        return self.client.post(
            reverse("mobile_leave_request_create"),
            data=json.dumps({
                "pin": pin,
                "device_key": f"android-{pin}",
                "leave_type": leave_type,
                "start_date": start,
                "end_date": end,
                "reason": reason,
            }),
            content_type="application/json",
        )

    def decide(self, client, item, action):
        return client.post(
            reverse("leave_request_decision", args=[item.pk]),
            data=json.dumps({"action": action}),
            content_type="application/json",
        )

    def test_mobile_request_is_routed_to_employee_team_leader(self):
        response = self.mobile_create("5101")

        self.assertEqual(response.status_code, 201, response.content)
        item = LeaveRequest.objects.get()
        self.assertEqual(item.team, self.team_a)
        self.assertEqual(item.assigned_leader, self.leader_a)
        self.assertEqual(item.reason, "Programare personală")
        self.assertEqual(response.json()["leave_request"]["status"], "pending")
        self.assertEqual(response.json()["leave_request"]["reason"], "Programare personală")

    @patch("ToolApp.mobile_views.send_leave_request_email")
    def test_new_leave_request_is_emailed_to_office_and_team_leader(self, send_email):
        self.leader_a.email = "lider@dmxconstruction.ro"
        self.leader_a.save(update_fields=("email",))

        response = self.mobile_create("5101")

        self.assertEqual(response.status_code, 201, response.content)
        item = LeaveRequest.objects.select_related("assigned_leader").get()
        send_email.assert_called_once_with(item)
        self.assertEqual(
            leave_request_recipients(item),
            ["lider@dmxconstruction.ro", LEAVE_REQUEST_OFFICE_EMAIL],
        )

    def test_mobile_request_without_active_team_is_rejected(self):
        response = self.mobile_create("5103")

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error_code"], "EMPLOYEE_WITHOUT_ACTIVE_TEAM")
        self.assertFalse(LeaveRequest.objects.exists())

    def test_leader_sees_only_requests_assigned_to_own_team(self):
        first = self.mobile_create("5101")
        second = self.mobile_create("5102", "2026-09-05", "2026-09-06")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)

        response_a = self.client_a.get(reverse("leave_requests_collection"))
        response_b = self.client_b.get(reverse("leave_requests_collection"))

        self.assertEqual(response_a.status_code, 200, response_a.content)
        self.assertEqual(response_b.status_code, 200, response_b.content)
        self.assertEqual([row["employee"]["id"] for row in response_a.json()["leave_requests"]], [self.worker_a.pk])
        self.assertEqual([row["employee"]["id"] for row in response_b.json()["leave_requests"]], [self.worker_b.pk])

    def test_leader_cannot_decide_another_teams_request(self):
        self.mobile_create("5102")
        item = LeaveRequest.objects.get()

        response = self.decide(self.client_a, item, "approve")

        self.assertEqual(response.status_code, 403)
        item.refresh_from_db()
        self.assertEqual(item.status, LeaveRequest.Status.PENDING)

    def test_leader_can_approve_and_android_receives_new_status(self):
        self.mobile_create("5101")
        item = LeaveRequest.objects.get()

        response = self.decide(self.client_a, item, "approve")

        self.assertEqual(response.status_code, 200, response.content)
        item.refresh_from_db()
        self.assertEqual(item.status, LeaveRequest.Status.APPROVED)
        self.assertEqual(item.reviewed_by_app_user, self.app_user_a)
        self.assertIsNotNone(item.reviewed_at)
        self.assertIsNotNone(item.approved_at)
        self.assertEqual(LeaveDay.objects.filter(source_leave_request=item).count(), 3)

        mobile = self.client.post(
            reverse("mobile_leave_request_list"),
            data=json.dumps({"pin": "5101", "device_key": "android-status-a"}),
            content_type="application/json",
        )
        payload = mobile.json()["leave_requests"][0]
        self.assertEqual(payload["status"], "approved")
        self.assertEqual(payload["status_label"], "Aprobată")
        self.assertEqual(payload["reason"], "Programare personală")

    def test_approved_paid_leave_populates_attendance_as_annual_leave(self):
        response = self.mobile_create(
            "5101",
            leave_type="paid_leave",
            reason="Vacanță planificată",
        )
        self.assertEqual(response.status_code, 201, response.content)
        item = LeaveRequest.objects.get()

        decision = self.decide(self.client_a, item, "approve")

        self.assertEqual(decision.status_code, 200, decision.content)
        leave_days = LeaveDay.objects.filter(source_leave_request=item).order_by("work_date")
        self.assertEqual(leave_days.count(), 3)
        self.assertTrue(all(day.reason == LeaveDay.Reason.CO for day in leave_days))
        self.assertTrue(all(day.get_reason_display() == "Concediu de odihnă" for day in leave_days))
        self.assertTrue(all(day.note == "Vacanță planificată" for day in leave_days))

    def test_leader_can_reject_request(self):
        self.mobile_create("5101")
        item = LeaveRequest.objects.get()

        response = self.decide(self.client_a, item, "reject")

        self.assertEqual(response.status_code, 200, response.content)
        item.refresh_from_db()
        self.assertEqual(item.status, LeaveRequest.Status.REJECTED)
        self.assertEqual(response.json()["leave_request"]["status_label"], "Respinsă")
        self.assertFalse(LeaveDay.objects.filter(source_leave_request=item).exists())

        mobile = self.client.post(
            reverse("mobile_leave_request_list"),
            data=json.dumps({"pin": "5101", "device_key": "android-status-rejected"}),
            content_type="application/json",
        )
        self.assertEqual(mobile.json()["leave_requests"][0]["status"], "rejected")
        self.assertEqual(mobile.json()["leave_requests"][0]["status_label"], "Respinsă")

    def test_administrator_sees_and_can_manage_all_requests(self):
        self.mobile_create("5101")
        self.mobile_create("5102", "2026-09-05", "2026-09-06")
        response = self.admin.get(reverse("leave_requests_collection"))

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(len(response.json()["leave_requests"]), 2)
        self.assertTrue(response.json()["permissions"]["can_manage_all"])

        item_b = LeaveRequest.objects.get(employee=self.worker_b)
        decision = self.decide(self.admin, item_b, "reject")
        self.assertEqual(decision.status_code, 200, decision.content)
        item_b.refresh_from_db()
        self.assertEqual(item_b.status, LeaveRequest.Status.REJECTED)

    def test_solved_request_cannot_be_decided_twice(self):
        self.mobile_create("5101")
        item = LeaveRequest.objects.get()
        self.assertEqual(self.decide(self.client_a, item, "reject").status_code, 200)

        second = self.decide(self.client_a, item, "approve")

        self.assertEqual(second.status_code, 409)

    def test_new_leave_request_notifies_assigned_leader_until_seen_and_resolved(self):
        response = self.mobile_create("5101")
        self.assertEqual(response.status_code, 201, response.content)

        summary = self.client_a.get(reverse("team_notifications_summary"))
        self.assertEqual(summary.status_code, 200, summary.content)
        self.assertEqual(summary.json()["leave_attention_count"], 1)
        self.assertEqual(summary.json()["attention_count"], 1)

        opened = self.client_a.get(reverse("team_notifications"))
        self.assertEqual(opened.status_code, 200, opened.content)
        self.assertEqual(len(opened.json()["leave_requests"]), 1)
        item = LeaveRequest.objects.get()
        item.refresh_from_db()
        self.assertIsNotNone(item.seen_at)
        self.assertEqual(self.client_a.get(reverse("team_notifications_summary")).json()["attention_count"], 1)

        self.assertEqual(self.decide(self.client_a, item, "approve").status_code, 200)
        self.assertEqual(self.client_a.get(reverse("team_notifications_summary")).json()["attention_count"], 0)

    def test_resolved_unseen_leave_notification_disappears_immediately(self):
        self.assertEqual(self.mobile_create("5101").status_code, 201)
        item = LeaveRequest.objects.get()
        self.assertEqual(self.client_a.get(reverse("team_notifications_summary")).json()["attention_count"], 1)

        self.assertEqual(self.decide(self.client_a, item, "reject").status_code, 200)

        item.refresh_from_db()
        self.assertIsNotNone(item.seen_at)
        self.assertEqual(self.client_a.get(reverse("team_notifications_summary")).json()["attention_count"], 0)

    def test_admin_can_mark_leave_range_and_it_reduces_employee_balance(self):
        response = self.admin.post(
            reverse("leave_mark_range"),
            data=json.dumps({
                "user_id": self.worker_a.pk,
                "start_date": "2026-08-17",
                "end_date": "2026-08-19",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["marked_days"], 3)
        self.assertEqual(
            LeaveDay.objects.filter(user_fk=self.worker_a, reason=LeaveDay.Reason.CO).count(),
            3,
        )
        self.assertEqual(response.json()["leave_balance"]["total_used_days"], 3)

    def test_admin_can_mark_each_supported_leave_type(self):
        expected = {
            "CO": (LeaveDay.Reason.CO, "1.00"),
            "CM": (LeaveDay.Reason.CM, "0.75"),
            "UNPAID": (LeaveDay.Reason.UNPAID, "0.00"),
            "INDIA": (LeaveDay.Reason.INDIA, "0.00"),
        }
        work_days = (1, 2, 3, 5)
        for day_number, (leave_type, (reason, multiplier)) in zip(work_days, expected.items()):
            with self.subTest(leave_type=leave_type):
                target = date(2026, 10, day_number)
                response = self.admin.post(
                    reverse("leave_mark_range"),
                    data=json.dumps({
                        "user_id": self.worker_a.pk,
                        "start_date": target.isoformat(),
                        "end_date": target.isoformat(),
                        "leave_type": leave_type,
                    }),
                    content_type="application/json",
                )
                self.assertEqual(response.status_code, 200, response.content)
                day = LeaveDay.objects.get(user_fk=self.worker_a, work_date=target)
                self.assertEqual(day.reason, reason)
                self.assertEqual(str(day.multiplier), multiplier)

    def test_employee_api_exposes_effective_hire_date_and_leave_balance(self):
        self.worker_a.hire_date = None
        self.worker_a.prior_paid_leave_days = 2
        self.worker_a.prior_paid_leave_year = 2026
        self.worker_a.save(update_fields=("hire_date", "prior_paid_leave_days", "prior_paid_leave_year"))
        from ToolApp.models import AttendanceSession
        AttendanceSession.objects.create(user_fk=self.worker_a, work_date=date(2026, 2, 10))

        response = self.admin.get(f"/api/user/{self.worker_a.pk}")

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["effective_hire_date"], "2026-02-10")
        self.assertEqual(response.json()["hire_date_source"], "first_attendance")
        self.assertEqual(response.json()["prior_paid_leave_days"], 2)
        self.assertIn("remaining_days", response.json()["leave_balance"])

    def test_manual_remaining_balance_is_returned_by_employee_and_team_apis(self):
        response = self.admin.put(
            "/api/user/",
            data=json.dumps({
                "UserId": self.worker_a.pk,
                "UserName": self.worker_a.UserName,
                "UserSerie": self.worker_a.UserSerie,
                "hire_date": "2024-01-01",
                "leave_remaining_override_days": "6.50",
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["leave_balance"]["remaining_days"], "6.50")

        team_response = self.admin.get(reverse("teams_collection"))
        self.assertEqual(team_response.status_code, 200, team_response.content)
        member = next(
            member
            for team in team_response.json()["teams"] if team["id"] == self.team_a.pk
            for member in team["members"] if member["id"] == self.worker_a.pk
        )
        self.assertEqual(member["leave_balance"]["remaining_days"], "6.50")

        marked = self.admin.post(
            reverse("leave_mark_range"),
            data=json.dumps({
                "user_id": self.worker_a.pk,
                "start_date": "2026-08-17",
                "end_date": "2026-08-18",
            }),
            content_type="application/json",
        )
        self.assertEqual(marked.status_code, 200, marked.content)
        self.assertEqual(marked.json()["leave_balance"]["remaining_days"], "4.50")
        self.assertEqual(self.admin.get(f"/api/user/{self.worker_a.pk}").json()["leave_balance"]["remaining_days"], "4.50")
