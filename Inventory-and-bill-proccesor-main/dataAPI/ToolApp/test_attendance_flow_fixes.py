"""Regresii pentru fluxul 07:30 / Nivel 1 / Nivel 2 (17.09.2026).

- „Vezi nepontați” rămânea goală după ora Nivelului 2, pentru că toți erau
  deja marcați automat absent;
- notificarea Nivelului 2 nu mai pleca dacă un request web marca absenții
  înaintea cronului;
- notificarea șefului de echipă dispărea după marcajul automat;
- personalul TESA era trecut automat absent.
"""
from datetime import time

from django.test import Client, TestCase, override_settings
from django.utils import timezone

from ToolApp.attendance_alert_escalation import (
    ensure_level2_auto_marks,
    process_escalation_level,
)
from ToolApp.models import (
    AppUser,
    AttendanceAbsenceMark,
    AttendanceAlertEscalationConfig,
    AttendanceAlertEscalationNotification,
    AttendanceSession,
    EmployeeTeam,
    EmployeeTeamMember,
    LeaveDay,
    Users,
)
from ToolApp.security import make_app_user_token
from ToolApp.team_attendance_notifications import create_team_attendance_alerts


def create_employee(name, serie, pin, **extra):
    person = Users(UserName=name, UserSerie=serie, person_type=Users.PersonType.EMPLOYEE, **extra)
    person.set_pin(pin)
    person.save()
    return person


def create_account(person, username):
    account = AppUser(employee=person, username=username)
    account.set_pin("9999")
    account.save()
    return account


@override_settings(TEAM_ALERT_NON_WORKING_WEEKDAYS=(), TEAM_ALERT_NON_WORKING_DATES=())
class AttendanceFlowFixesTests(TestCase):
    def setUp(self):
        self.day = timezone.localdate()
        self.leader = create_employee("Șef Flux", "FLX-L", "8101")
        self.member = create_employee("Muncitor Lipsă", "FLX-M", "8102")
        self.tesa = create_employee("Birou TESA", "FLX-T", "8103", is_tesa=True)
        self.team = EmployeeTeam.objects.create(name="Echipa Flux", leader=self.leader, supervisor=self.leader)
        for person in (self.leader, self.member, self.tesa):
            EmployeeTeamMember.objects.create(team=self.team, employee=person)
        AttendanceSession.objects.create(user_fk=self.leader, work_date=self.day, worksite="diverse")
        self.level1 = create_account(create_employee("Nivel Unu", "FLX-N1", "8110"), "flux.unu")
        self.level2 = create_account(create_employee("Nivel Doi", "FLX-N2", "8111"), "flux.doi")
        # Ambele ore în trecut: suntem „după 08:10”.
        for level, account, alert_time in ((1, self.level1, time(0, 1)), (2, self.level2, time(0, 2))):
            AttendanceAlertEscalationConfig.objects.update_or_create(
                level=level,
                defaults={"role_name": f"Nivel {level}", "app_user": account, "email": "", "alert_time": alert_time, "active": True},
            )

    def client_for(self, account):
        client = Client()
        client.cookies["appj"] = make_app_user_token(account)
        return client

    def test_missing_list_still_shows_employees_after_automatic_level_2_marking(self):
        ensure_level2_auto_marks(self.day)
        self.assertTrue(AttendanceAbsenceMark.objects.filter(employee=self.member, work_date=self.day).exists())

        payload = self.client_for(self.level1).get("/api/team-portal/missing-today/").json()
        rows = {row["id"]: row for row in payload["employees"]}
        self.assertIn(self.member.pk, rows)
        self.assertEqual(rows[self.member.pk]["status"], "marked_absent")
        self.assertEqual(rows[self.member.pk]["marked_by"], "Automat · Nivel 2")
        self.assertGreater(payload["count"], 0)

    def test_missing_list_drops_an_employee_who_checks_in_after_marking(self):
        ensure_level2_auto_marks(self.day)
        AttendanceSession.objects.create(user_fk=self.member, work_date=self.day, worksite="diverse")
        payload = self.client_for(self.level1).get("/api/team-portal/missing-today/").json()
        self.assertNotIn(self.member.pk, {row["id"] for row in payload["employees"]})

    def test_tesa_staff_is_never_marked_absent_or_listed(self):
        ensure_level2_auto_marks(self.day)
        self.assertFalse(AttendanceAbsenceMark.objects.filter(employee=self.tesa).exists())
        self.assertFalse(LeaveDay.objects.filter(user_fk=self.tesa).exists())
        payload = self.client_for(self.level1).get("/api/team-portal/missing-today/").json()
        self.assertNotIn(self.tesa.pk, {row["id"] for row in payload["employees"]})

    def test_level_2_notification_is_sent_even_if_marks_ran_before_the_cron(self):
        # Un request web după 08:10 marchează absenții înainte de cron.
        ensure_level2_auto_marks(self.day)
        result = process_escalation_level(2, self.day, send_email=False, send_push=False)
        self.assertEqual(result["status"], "completed")
        # Muncitorul + cele două conturi Nivel 1/2 (nici ele nu s-au pontat); fără TESA.
        self.assertEqual(result["count"], 3)
        notification = AttendanceAlertEscalationNotification.objects.get(
            recipient=self.level2, work_date=self.day, level=2,
        )
        self.assertEqual(notification.case_count, 3)

    def test_web_request_sends_level_notifications_when_cron_did_not_run(self):
        self.client_for(self.level2).get("/api/team-portal/absent-today/")
        self.assertTrue(AttendanceAlertEscalationNotification.objects.filter(
            recipient=self.level2, work_date=self.day, level=2, case_count__gt=0,
        ).exists())

    def test_team_leader_notification_keeps_employees_marked_absent(self):
        create_team_attendance_alerts(self.day, send_email=False, send_push=False)
        ensure_level2_auto_marks(self.day)
        leader_account = create_account(self.leader, "flux.sef")
        payload = self.client_for(leader_account).get("/api/team-portal/notifications/").json()
        team_items = [item for item in payload["notifications"] if item.get("kind") == "team"]
        self.assertTrue(team_items)
        employees = {row["id"]: row for row in team_items[0]["employees"]}
        self.assertIn(self.member.pk, employees)
        self.assertEqual(employees[self.member.pk]["status"], "marked_absent")
        self.assertNotIn(self.tesa.pk, employees)
