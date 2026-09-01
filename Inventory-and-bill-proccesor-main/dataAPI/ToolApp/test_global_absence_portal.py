from datetime import time

from django.test import Client, TestCase, override_settings
from django.utils import timezone

from ToolApp.models import (
    AppUser,
    AttendanceAbsenceMark,
    AttendanceAlertCase,
    AttendanceAlertEscalationConfig,
    AttendanceSession,
    EmployeeTeam,
    EmployeeTeamMember,
    Users,
)
from ToolApp.security import make_app_user_token


def create_employee(name, serie, pin, phone=""):
    person = Users(
        UserName=name,
        UserSerie=serie,
        person_type=Users.PersonType.EMPLOYEE,
        phone_number=phone,
    )
    person.set_pin(pin)
    person.save()
    return person


def create_account(person, username):
    account = AppUser(employee=person, username=username)
    account.set_pin("9999")
    account.save()
    return account


@override_settings(TEAM_ALERT_NON_WORKING_WEEKDAYS=(), TEAM_ALERT_NON_WORKING_DATES=())
class GlobalAbsencePortalTests(TestCase):
    """Nivel 1 și Nivel 2 lucrează pe toată compania, nu doar pe echipele lor."""

    def setUp(self):
        self.day = timezone.localdate()
        self.leader_a = create_employee("Șef A", "GLB-LA", "7001", "0700000001")
        self.leader_b = create_employee("Șef B", "GLB-LB", "7002", "0700000002")
        self.member_a = create_employee("Angajat A", "GLB-MA", "7003", "0700000003")
        self.member_b = create_employee("Angajat B", "GLB-MB", "7004", "0700000004")
        self.present = create_employee("Angajat Pontat", "GLB-MP", "7005")
        self.no_team = create_employee("Angajat Fără Echipă", "GLB-NT", "7006", "0700000006")
        self.team_a = EmployeeTeam.objects.create(name="Echipa A", leader=self.leader_a, supervisor=self.leader_a)
        self.team_b = EmployeeTeam.objects.create(name="Echipa B", leader=self.leader_b, supervisor=self.leader_b)
        for team, people in ((self.team_a, (self.leader_a, self.member_a)), (self.team_b, (self.leader_b, self.member_b, self.present))):
            for person in people:
                EmployeeTeamMember.objects.create(team=team, employee=person)
        AttendanceSession.objects.create(user_fk=self.present, work_date=self.day, worksite="diverse")
        AttendanceSession.objects.create(user_fk=self.leader_a, work_date=self.day, worksite="diverse")
        AttendanceSession.objects.create(user_fk=self.leader_b, work_date=self.day, worksite="diverse")

        self.level1_employee = create_employee("Coordonator Nivel 1", "GLB-N1", "7010")
        self.level2_employee = create_employee("Director Nivel 2", "GLB-N2", "7011")
        self.level1 = create_account(self.level1_employee, "nivel.unu")
        self.level2 = create_account(self.level2_employee, "nivel.doi")
        # Ora Nivelului 1 în trecut: lista „Vezi nepontați” este deja disponibilă.
        self.configure(1, self.level1, time(0, 1))
        self.configure(2, self.level2, time(23, 59))

    def configure(self, level, account, alert_time):
        AttendanceAlertEscalationConfig.objects.update_or_create(
            level=level,
            defaults={
                "role_name": f"Nivel {level}",
                "app_user": account,
                "email": f"nivel{level}@example.test",
                "alert_time": alert_time,
                "active": True,
            },
        )

    def client_for(self, account):
        client = Client()
        client.cookies["appj"] = make_app_user_token(account)
        return client

    def test_level_1_sees_every_missing_employee_in_the_company(self):
        response = self.client_for(self.level1).get("/api/team-portal/missing-today/")
        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        ids = {row["id"] for row in payload["employees"]}
        # Nivel 1 nu conduce nicio echipă, dar vede membrii ambelor echipe.
        self.assertIn(self.member_a.pk, ids)
        self.assertIn(self.member_b.pk, ids)
        self.assertIn(self.no_team.pk, ids)
        self.assertNotIn(self.present.pk, ids)
        row = next(item for item in payload["employees"] if item["id"] == self.member_a.pk)
        self.assertEqual(row["team"]["name"], "Echipa A")
        self.assertEqual(row["team"]["leader_name"], "Șef A")
        self.assertEqual(row["team"]["leader_phone"], "0700000001")
        self.assertTrue(row["can_mark_absent"])

    def test_missing_list_is_empty_before_the_level_1_hour(self):
        # Înainte de ora configurată pentru Nivel 1 angajații încă se pot ponta.
        self.configure(1, self.level1, time(23, 58))
        payload = self.client_for(self.level1).get("/api/team-portal/missing-today/").json()
        self.assertTrue(payload["before_alert_time"])
        self.assertEqual(payload["employees"], [])
        self.assertEqual(payload["count"], 0)
        self.assertEqual(payload["available_from"], "23:58")

        dashboard = self.client_for(self.level1).get("/api/team-portal/dashboard/").json()
        self.assertEqual(dashboard["missing_today_count"], 0)
        self.assertTrue(dashboard["missing_before_alert_time"])
        self.assertEqual(dashboard["missing_available_from"], "23:58")

    def test_missing_list_uses_the_configured_level_1_hour(self):
        payload = self.client_for(self.level1).get("/api/team-portal/missing-today/").json()
        self.assertFalse(payload["before_alert_time"])
        self.assertEqual(payload["available_from"], "00:01")
        self.assertIn(self.member_a.pk, {row["id"] for row in payload["employees"]})

    def test_dashboard_separates_roles_and_exposes_cards(self):
        payload = self.client_for(self.level1).get("/api/team-portal/dashboard/").json()
        self.assertFalse(payload["is_team_leader"])
        self.assertTrue(payload["alert_level_1"])
        self.assertFalse(payload["alert_level_2"])
        self.assertIn("missing_today_count", payload)
        self.assertNotIn("absent_today_count", payload)

        leader_account = create_account(self.leader_a, "sef.a")
        leader_payload = self.client_for(leader_account).get("/api/team-portal/dashboard/").json()
        self.assertTrue(leader_payload["is_team_leader"])
        self.assertFalse(leader_payload["alert_level_1"])

    def test_level_1_marking_escalates_immediately_to_level_2(self):
        response = self.client_for(self.level1).post(
            f"/api/team-portal/teams/members/{self.member_b.pk}/absent/",
            data="{}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["escalated_to_level"], AttendanceAlertCase.Level.LEVEL_2)
        mark = AttendanceAbsenceMark.objects.get(employee=self.member_b, work_date=self.day)
        self.assertEqual(mark.source, AttendanceAbsenceMark.Source.LEVEL_1)
        self.assertEqual(mark.marked_by, self.level1)
        case = AttendanceAlertCase.objects.get(
            employee=self.member_b, work_date=self.day, level=AttendanceAlertCase.Level.LEVEL_2
        )
        self.assertEqual(case.escalation_source, AttendanceAlertCase.EscalationSource.MARKED_BY_LEVEL_1)
        self.assertEqual(case.escalated_by, self.level1)

        # Cazul apare imediat la Nivel 2, chiar dacă ora de escaladare nu a trecut.
        payload = self.client_for(self.level2).get("/api/team-portal/absent-today/").json()
        row = next(item for item in payload["employees"] if item["id"] == self.member_b.pk)
        self.assertEqual(row["category"], AttendanceAlertCase.EscalationSource.MARKED_BY_LEVEL_1)
        self.assertEqual(row["marked_by"], self.level1_employee.UserName)
        self.assertEqual(row["team"]["name"], "Echipa B")

        # Angajatul marcat rămâne vizibil și auditabil după refresh.
        missing = self.client_for(self.level1).get("/api/team-portal/missing-today/").json()
        marked_row = next(item for item in missing["employees"] if item["id"] == self.member_b.pk)
        self.assertEqual(marked_row["status"], "marked_absent")
        self.assertFalse(marked_row["can_mark_absent"])
        self.assertEqual(marked_row["marked_by"], self.level1_employee.UserName)

    def test_level_1_can_mark_an_employee_without_a_team(self):
        response = self.client_for(self.level1).post(
            f"/api/team-portal/teams/members/{self.no_team.pk}/absent/",
            data="{}",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        mark = AttendanceAbsenceMark.objects.get(employee=self.no_team, work_date=self.day)
        self.assertIsNone(mark.team_id)
        self.assertEqual(mark.source, AttendanceAbsenceMark.Source.LEVEL_1)
        case = AttendanceAlertCase.objects.get(
            employee=self.no_team,
            work_date=self.day,
            level=AttendanceAlertCase.Level.LEVEL_2,
        )
        self.assertIsNone(case.team_id)
        self.assertEqual(case.escalation_source, AttendanceAlertCase.EscalationSource.MARKED_BY_LEVEL_1)

        refreshed = self.client_for(self.level1).get("/api/team-portal/missing-today/").json()
        row = next(item for item in refreshed["employees"] if item["id"] == self.no_team.pk)
        self.assertEqual(row["status"], "marked_absent")
        self.assertEqual(row["team"]["name"], "Fără echipă")

    def test_level_2_list_includes_automatic_cases_after_lock_time(self):
        self.configure(2, self.level2, time(0, 1))
        payload = self.client_for(self.level2).get("/api/team-portal/absent-today/").json()
        rows = {item["id"]: item for item in payload["employees"]}
        self.assertIn(self.member_a.pk, rows)
        self.assertIn(self.member_b.pk, rows)
        self.assertIn(self.no_team.pk, rows)
        self.assertEqual(rows[self.member_a.pk]["category"], AttendanceAlertCase.EscalationSource.SCHEDULED_0810)
        self.assertTrue(rows[self.member_a.pk]["locked"])
        self.assertNotIn(self.present.pk, rows)

    def test_level_1_notifications_cover_all_company_teams(self):
        from ToolApp.team_attendance_notifications import create_team_attendance_alerts

        create_team_attendance_alerts(self.day, send_email=False, send_push=False)
        payload = self.client_for(self.level1).get("/api/team-portal/notifications/").json()
        ids = {
            employee["id"]
            for item in payload["notifications"]
            for employee in item["employees"]
        }
        self.assertIn(self.member_a.pk, ids)
        self.assertIn(self.member_b.pk, ids)
        self.assertNotIn(self.present.pk, ids)

    def test_level_1_notifications_are_hidden_before_its_alert_time(self):
        self.configure(1, self.level1, time(23, 58))
        notifications = self.client_for(self.level1).get("/api/team-portal/notifications/").json()
        self.assertEqual(notifications["notifications"], [])
        self.assertEqual(notifications["unread_count"], 0)
        dashboard = self.client_for(self.level1).get("/api/team-portal/dashboard/").json()
        self.assertEqual(dashboard["unread_notifications"], 0)

    def test_combined_leader_and_level_1_keeps_the_0740_team_notifications(self):
        from ToolApp.team_attendance_notifications import create_team_attendance_alerts

        leader_account = create_account(self.leader_a, "sef.a.combined")
        self.configure(1, leader_account, time(23, 58))
        create_team_attendance_alerts(self.day, send_email=False, send_push=False)
        payload = self.client_for(leader_account).get("/api/team-portal/notifications/").json()
        team_notifications = [item for item in payload["notifications"] if item.get("kind") == "team"]
        self.assertEqual(len(team_notifications), 1)
        self.assertEqual(team_notifications[0]["team"]["id"], self.team_a.pk)
        self.assertIn(self.member_a.pk, {row["id"] for row in team_notifications[0]["employees"]})
        self.assertFalse(any(item.get("kind") == "escalation" for item in payload["notifications"]))

    def test_team_notification_removes_an_employee_after_check_in(self):
        from ToolApp.team_attendance_notifications import create_team_attendance_alerts

        leader_account = create_account(self.leader_a, "sef.a.resolved")
        create_team_attendance_alerts(self.day, send_email=False, send_push=False)
        AttendanceSession.objects.create(user_fk=self.member_a, work_date=self.day, worksite="diverse")
        payload = self.client_for(leader_account).get("/api/team-portal/notifications/").json()
        ids = {
            employee["id"]
            for item in payload["notifications"]
            for employee in item["employees"]
        }
        self.assertNotIn(self.member_a.pk, ids)

    def test_level_2_notifications_before_its_hour_only_show_manual_escalations(self):
        before_mark = self.client_for(self.level2).get("/api/team-portal/notifications/").json()
        self.assertEqual(before_mark["notifications"], [])
        dashboard_before_mark = self.client_for(self.level2).get("/api/team-portal/dashboard/").json()
        self.assertEqual(dashboard_before_mark["unread_notifications"], 0)

        response = self.client_for(self.level1).post(
            f"/api/team-portal/teams/members/{self.member_b.pk}/absent/",
            data="{}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        after_mark = self.client_for(self.level2).get("/api/team-portal/notifications/").json()
        ids = {
            employee["id"]
            for item in after_mark["notifications"]
            for employee in item["employees"]
        }
        self.assertEqual(ids, {self.member_b.pk})
        dashboard_after_mark = self.client_for(self.level2).get("/api/team-portal/dashboard/").json()
        self.assertEqual(dashboard_after_mark["unread_notifications"], 1)

    def test_level_2_list_is_not_available_to_a_plain_team_leader(self):
        leader_account = create_account(self.leader_a, "sef.a.denied")
        response = self.client_for(leader_account).get("/api/team-portal/absent-today/")
        self.assertEqual(response.status_code, 403)
        response = self.client_for(leader_account).get("/api/team-portal/missing-today/")
        self.assertEqual(response.status_code, 403)
