import json
from datetime import date, datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import Client, TestCase, override_settings

from ToolApp.attendance_alert_escalation import process_due_attendance_alerts, process_escalation_level
from ToolApp.models import (
    AppPagePermission,
    AppUser,
    AttendanceAbsenceMark,
    AttendanceAlertCase,
    AttendanceAlertDispatch,
    AttendanceAlertEscalationConfig,
    AttendanceAlertEscalationNotification,
    AttendanceAlertRunLog,
    AttendanceSession,
    EmployeeTeam,
    EmployeeTeamMember,
    Users,
)
from ToolApp.security import make_admin_token, make_app_user_token


def create_employee(name, serie, pin):
    employee = Users(UserName=name, UserSerie=serie, person_type=Users.PersonType.EMPLOYEE)
    employee.set_pin(pin)
    employee.save()
    return employee


@override_settings(TEAM_ALERT_NON_WORKING_WEEKDAYS=(7,), TEAM_ALERT_NON_WORKING_DATES=())
class AttendanceEscalationTests(TestCase):
    def setUp(self):
        self.day = date(2026, 8, 27)
        self.tz = ZoneInfo("Europe/Bucharest")
        self.leader = create_employee("Șef Test", "ESC-L", "8100")
        self.target = create_employee("Membru Nepontat", "ESC-M", "8101")
        self.recipient_employee = create_employee("Director Test", "ESC-D", "8102")
        self.recipient_employee.email = "director@example.test"
        self.recipient_employee.save(update_fields=("email",))
        self.recipient = AppUser(employee=self.recipient_employee, username="director.test")
        self.recipient.set_pin("8102")
        self.recipient.save()
        self.team = EmployeeTeam.objects.create(
            name="Echipa escaladare",
            leader=self.leader,
            supervisor=self.leader,
            default_worksite="diverse",
        )
        EmployeeTeamMember.objects.create(team=self.team, employee=self.leader)
        EmployeeTeamMember.objects.create(team=self.team, employee=self.target)
        AttendanceSession.objects.create(user_fk=self.leader, work_date=self.day, worksite="diverse")
        for level in (1, 2):
            config = AttendanceAlertEscalationConfig.objects.get(level=level)
            config.app_user = self.recipient
            config.email = self.recipient_employee.email
            config.save()

    @patch("ToolApp.attendance_alert_escalation._send_central_email")
    @patch("ToolApp.team_attendance_notifications._send_email", return_value=True)
    @patch("ToolApp.team_attendance_notifications.send_employee_push", return_value={"sent": 0, "invalid": 0, "failed": 0})
    def test_three_levels_are_idempotent_and_central_emails_are_sent_once(self, _push, _initial_email, central_email):
        process_due_attendance_alerts(datetime(2026, 8, 27, 7, 40, tzinfo=self.tz), send_push=False)
        self.assertEqual(AttendanceAlertCase.objects.filter(level=0, employee=self.target).count(), 1)
        self.assertFalse(AttendanceAlertCase.objects.filter(level=1).exists())

        process_due_attendance_alerts(datetime(2026, 8, 27, 7, 55, tzinfo=self.tz), send_push=False)
        process_due_attendance_alerts(datetime(2026, 8, 27, 8, 10, tzinfo=self.tz), send_push=False)
        process_due_attendance_alerts(datetime(2026, 8, 27, 8, 11, tzinfo=self.tz), send_push=False)

        self.assertEqual(AttendanceAlertCase.objects.filter(employee=self.target, work_date=self.day).count(), 3)
        self.assertEqual(AttendanceAlertEscalationNotification.objects.count(), 2)
        self.assertEqual(AttendanceAlertDispatch.objects.filter(email_sent_at__isnull=False).count(), 2)
        self.assertEqual(central_email.call_count, 2)
        self.assertGreaterEqual(AttendanceAlertRunLog.objects.filter(work_date=self.day).count(), 8)

    @patch("ToolApp.attendance_alert_escalation._send_central_email")
    def test_resolved_between_levels_is_not_escalated(self, _central_email):
        process_escalation_level(1, self.day, datetime(2026, 8, 27, 7, 55, tzinfo=self.tz))
        mark = AttendanceAbsenceMark.objects.create(
            employee=self.target,
            team=self.team,
            work_date=self.day,
            marked_by=self.recipient,
        )

        result = process_escalation_level(2, self.day, datetime(2026, 8, 27, 8, 10, tzinfo=self.tz))

        self.assertEqual(result["count"], 0)
        level_one = AttendanceAlertCase.objects.get(employee=self.target, work_date=self.day, level=1)
        self.assertEqual(level_one.resolution_method, AttendanceAlertCase.ResolutionMethod.MARKED_ABSENT)
        self.assertEqual(level_one.resolved_by, mark.marked_by)
        self.assertFalse(AttendanceAlertCase.objects.filter(employee=self.target, work_date=self.day, level=2).exists())

    @patch("ToolApp.attendance_alert_escalation._send_central_email")
    def test_check_in_before_next_level_resolves_previous_case(self, _central_email):
        process_escalation_level(1, self.day, datetime(2026, 8, 27, 7, 55, tzinfo=self.tz))
        AttendanceSession.objects.create(user_fk=self.target, work_date=self.day, worksite="diverse")

        process_escalation_level(2, self.day, datetime(2026, 8, 27, 8, 10, tzinfo=self.tz))

        case = AttendanceAlertCase.objects.get(employee=self.target, level=1, work_date=self.day)
        self.assertEqual(case.resolution_method, AttendanceAlertCase.ResolutionMethod.CHECK_IN)
        self.assertFalse(AttendanceAlertCase.objects.filter(employee=self.target, level=2).exists())

    def test_sunday_is_skipped(self):
        result = process_due_attendance_alerts(datetime(2026, 8, 30, 8, 10, tzinfo=self.tz), send_email=False, send_push=False)
        self.assertTrue(result["skipped_non_working_day"])
        self.assertFalse(AttendanceAlertCase.objects.exists())


class AttendanceAlertsPermissionApiTests(TestCase):
    def setUp(self):
        employee = create_employee("Cont Alerte", "ESC-A", "8200")
        self.account = AppUser(employee=employee, username="alerte.user")
        self.account.set_pin("8200")
        self.account.save()
        self.client = Client()
        self.client.cookies["appj"] = make_app_user_token(self.account)

    def test_requires_explicit_page_permission(self):
        self.assertEqual(self.client.get("/api/attendance-alerts/").status_code, 403)
        AppPagePermission.objects.create(app_user=self.account, route="/pontaj/alerte", can_access=True)
        self.assertEqual(self.client.get("/api/attendance-alerts/").status_code, 200)
        response = self.client.put(
            "/api/attendance-alerts/",
            data=json.dumps({"configs": [{"level": 1, "role_name": "Director", "alert_time": "07:56", "active": False}]}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        config = AttendanceAlertEscalationConfig.objects.get(level=1)
        self.assertEqual(config.role_name, "Director")
        self.assertFalse(config.active)

    def test_legacy_admin_has_access(self):
        admin = Client()
        admin.cookies["ptj"] = make_admin_token()
        self.assertEqual(admin.get("/api/attendance-alerts/").status_code, 200)
