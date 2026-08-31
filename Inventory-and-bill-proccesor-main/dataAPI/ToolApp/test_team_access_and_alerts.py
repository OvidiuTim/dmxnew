import json
from datetime import date, datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import Client, TestCase, override_settings

from ToolApp.app_accounts import sync_employee_app_user
from ToolApp.models import (
    AppModuleAccess,
    AppUser,
    AttendanceAbsenceMark,
    AttendanceSession,
    EmployeeTeam,
    EmployeeTeamMember,
    LeaveDay,
    MobileDevice,
    TeamAttendanceAlert,
    TeamAttendanceAlertRecipient,
    Users,
)
from ToolApp.module_access import app_user_roles, effective_module_codes
from ToolApp.security import make_app_user_token
from ToolApp.push_notifications import send_employee_push
from ToolApp.team_attendance_notifications import create_team_attendance_alerts, ensure_team_attendance_alerts_due


def employee(name, serie, pin):
    item = Users(UserName=name, UserSerie=serie, person_type=Users.PersonType.EMPLOYEE)
    item.set_pin(pin)
    item.save()
    return item


class AutomaticAppUserTests(TestCase):
    def test_create_update_deactivate_and_reactivate_without_duplicates(self):
        person = employee("Ana Popescu", "AUTO-1", "1234")
        account, created = sync_employee_app_user(person)
        self.assertTrue(created)
        self.assertTrue(account.check_pin("1234"))
        self.assertNotEqual(account.pin_hash, "1234")

        again, created_again = sync_employee_app_user(person)
        self.assertFalse(created_again)
        self.assertEqual(again.pk, account.pk)
        self.assertEqual(AppUser.objects.filter(employee=person).count(), 1)

        person.employment_status = Users.EmploymentStatus.DISMISSED
        person.active = False
        person.save(update_fields=("employment_status", "active"))
        sync_employee_app_user(person)
        account.refresh_from_db()
        self.assertFalse(account.is_active)

        person.employment_status = Users.EmploymentStatus.ACTIVE
        person.active = True
        person.set_pin("4321")
        person.save()
        sync_employee_app_user(person)
        account.refresh_from_db()
        self.assertTrue(account.is_active)
        self.assertTrue(account.check_pin("4321"))


class EffectiveTeamPermissionTests(TestCase):
    def setUp(self):
        self.coordinator = employee("Coordonator", "ROLE-1", "2001")
        self.account = AppUser(employee=self.coordinator, username="coordonator")
        self.account.set_pin("2001")
        self.account.save()
        self.team = EmployeeTeam.objects.create(
            name="Echipa roluri",
            leader=self.coordinator,
            supervisor=self.coordinator,
            default_worksite="diverse",
        )
        EmployeeTeamMember.objects.create(team=self.team, employee=self.coordinator)

    def test_same_person_has_both_roles_and_all_team_pages(self):
        self.assertEqual(app_user_roles(self.account), ["team_leader", "supervisor"])
        self.assertIn("teams_schedule", effective_module_codes(self.account))
        self.assertIn("team_dashboard", effective_module_codes(self.account))
        client = Client()
        client.cookies["appj"] = make_app_user_token(self.account)
        for route in ("/pontaj/echipe", "/pontaj/echipa-mea", "/pontaj/concedii", "/pontaj/echipe-azi", "/pontaj/personal", "/pontaj/notificari"):
            response = client.post(
                "/api/app-auth/verify/",
                data=json.dumps({"route": route, "module_code": "teams_schedule"}),
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()["can_access"])

        portal = client.get("/api/team-portal/dashboard/")
        self.assertEqual(portal.status_code, 200, portal.content)

    def test_role_removal_removes_only_inherited_access(self):
        self.team.active = False
        self.team.save(update_fields=("active",))
        self.assertNotIn("teams_schedule", effective_module_codes(self.account))
        self.assertNotIn("team_dashboard", effective_module_codes(self.account))
        AppModuleAccess.objects.create(app_user=self.account, module_code="teams_schedule", can_access=True)
        self.assertIn("teams_schedule", effective_module_codes(self.account))

    def test_manual_module_permission_reaches_team_view_without_403(self):
        other = employee("Utilizator manual", "ROLE-2", "2002")
        account = AppUser(employee=other, username="manual")
        account.set_pin("2002")
        account.save()
        AppModuleAccess.objects.create(app_user=account, module_code="teams_schedule", can_access=True)
        client = Client()
        client.cookies["appj"] = make_app_user_token(account)
        response = client.get("/api/teams/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()["permissions"]["can_manage_all"])

    def test_manual_team_dashboard_permission_allows_own_data_without_team_data(self):
        other = employee("Portal manual", "ROLE-3", "2003")
        account = AppUser(employee=other, username="portal.manual")
        account.set_pin("2003")
        account.save()
        AppModuleAccess.objects.create(app_user=account, module_code="team_dashboard", can_access=True)
        client = Client()
        client.cookies["appj"] = make_app_user_token(account)

        dashboard = client.get("/api/team-portal/dashboard/")
        salary = client.get("/api/team-portal/salary/")
        teams = client.get("/api/team-portal/teams/")

        self.assertEqual(dashboard.status_code, 200, dashboard.content)
        self.assertEqual(salary.status_code, 200, salary.content)
        self.assertEqual(teams.json()["teams"], [])

    def test_user_without_role_or_manual_access_cannot_open_portal(self):
        other = employee("Fără acces", "ROLE-4", "2004")
        account = AppUser(employee=other, username="no.portal")
        account.set_pin("2004")
        account.save()
        client = Client()
        client.cookies["appj"] = make_app_user_token(account)
        self.assertEqual(client.get("/api/team-portal/dashboard/").status_code, 403)


@override_settings(TEAM_ALERT_NON_WORKING_WEEKDAYS=(7,), TEAM_ALERT_NON_WORKING_DATES=())
class TeamAttendanceAlertTests(TestCase):
    def setUp(self):
        self.day = date(2026, 8, 27)
        self.manager = employee("Manager", "ALERT-M", "3001")
        self.manager.email = "manager@example.test"
        self.manager.save(update_fields=("email",))
        self.team = EmployeeTeam.objects.create(
            name="Echipa alertă",
            leader=self.manager,
            supervisor=self.manager,
            default_worksite="diverse",
        )
        EmployeeTeamMember.objects.create(team=self.team, employee=self.manager)

    def add_member(self, name, suffix):
        item = employee(name, f"ALERT-{suffix}", f"31{suffix}")
        EmployeeTeamMember.objects.create(team=self.team, employee=item)
        return item

    @patch("ToolApp.team_attendance_notifications.send_employee_push", return_value={"sent": 1, "invalid": 0, "failed": 0})
    @patch("ToolApp.team_attendance_notifications._send_email", return_value=True)
    def test_groups_missing_members_once_and_excludes_ineligible_people(self, email_mock, push_mock):
        missing = self.add_member("Lipsă", "01")
        present = self.add_member("Prezent", "02")
        on_leave = self.add_member("Concediu", "03")
        exempt = self.add_member("Exceptat", "04")
        dismissed = self.add_member("Demis", "05")
        exempt.attendance_exempt = True
        exempt.save(update_fields=("attendance_exempt",))
        dismissed.active = False
        dismissed.employment_status = Users.EmploymentStatus.DISMISSED
        dismissed.dismissed_at = self.day
        dismissed.save(update_fields=("active", "employment_status", "dismissed_at"))
        AttendanceSession.objects.create(user_fk=present, work_date=self.day, worksite="diverse")
        LeaveDay.objects.create(user_fk=on_leave, work_date=self.day, reason=LeaveDay.Reason.CO)

        first = create_team_attendance_alerts(self.day)
        second = create_team_attendance_alerts(self.day)

        self.assertEqual(first["created"], 1)
        self.assertEqual(second["duplicates"], 1)
        alert = TeamAttendanceAlert.objects.get(team=self.team, work_date=self.day)
        missing_ids = set(alert.missing_employees.values_list("pk", flat=True))
        self.assertIn(missing.pk, missing_ids)
        self.assertIn(self.manager.pk, missing_ids)
        self.assertNotIn(present.pk, missing_ids)
        self.assertNotIn(on_leave.pk, missing_ids)
        self.assertNotIn(exempt.pk, missing_ids)
        self.assertNotIn(dismissed.pk, missing_ids)
        self.assertEqual(alert.recipients.count(), 1)
        email_mock.assert_called_once()
        push_mock.assert_called_once()

    def test_sunday_is_skipped(self):
        result = create_team_attendance_alerts(date(2026, 8, 30), send_email=False, send_push=False)
        self.assertTrue(result["skipped_non_working_day"])
        self.assertFalse(TeamAttendanceAlert.objects.exists())

    @patch("ToolApp.team_attendance_notifications._send_email", return_value=False)
    def test_due_time_is_bucharest_0740_and_is_idempotent(self, _email_mock):
        missing = self.add_member("Nepontat la timp", "06")
        tz = ZoneInfo("Europe/Bucharest")

        early = ensure_team_attendance_alerts_due(datetime(2026, 8, 27, 7, 39, tzinfo=tz), send_email=False, send_push=False)
        self.assertTrue(early["before_alert_time"])
        self.assertFalse(TeamAttendanceAlert.objects.exists())

        due = ensure_team_attendance_alerts_due(datetime(2026, 8, 27, 7, 40, tzinfo=tz), send_email=False, send_push=False)
        duplicate = ensure_team_attendance_alerts_due(datetime(2026, 8, 27, 8, 0, tzinfo=tz), send_email=False, send_push=False)
        self.assertEqual(due["created"], 1)
        self.assertEqual(duplicate["duplicates"], 1)
        alert = TeamAttendanceAlert.objects.get(team=self.team, work_date=self.day)
        self.assertIn(missing, alert.missing_employees.all())
        self.assertEqual(alert.recipients.filter(employee=self.manager).count(), 1)

    def test_mark_absent_records_actor_updates_status_and_stops_alert(self):
        missing = self.add_member("Absent confirmat", "07")
        account = AppUser(employee=self.manager, username="manager.portal")
        account.set_pin("3001")
        account.save()
        today = date.today()
        alert = TeamAttendanceAlert.objects.create(team=self.team, work_date=today)
        alert.missing_employees.add(missing)
        TeamAttendanceAlertRecipient.objects.create(alert=alert, employee=self.manager)
        client = Client()
        client.cookies["appj"] = make_app_user_token(account)

        response = client.post(f"/api/team-portal/teams/members/{missing.pk}/absent/", data="{}", content_type="application/json")

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["status"], "marked_absent")
        self.assertTrue(LeaveDay.objects.filter(user_fk=missing, work_date=today, reason=LeaveDay.Reason.UNEXCUSED).exists())
        mark = AttendanceAbsenceMark.objects.get(employee=missing, work_date=today)
        self.assertEqual(mark.marked_by, account)
        self.assertFalse(alert.missing_employees.filter(pk=missing.pk).exists())
        teams = client.get("/api/team-portal/teams/").json()["teams"]
        self.assertEqual(next(item for item in teams[0]["members"] if item["id"] == missing.pk)["status"], "marked_absent")

    def test_cannot_mark_member_of_another_team_absent(self):
        outsider = employee("Altă echipă", "ALERT-X", "3999")
        other_leader = employee("Alt lider", "ALERT-L", "3998")
        other_team = EmployeeTeam.objects.create(name="Altă echipă", leader=other_leader, supervisor=other_leader)
        EmployeeTeamMember.objects.create(team=other_team, employee=outsider)
        account = AppUser(employee=self.manager, username="manager.denied")
        account.set_pin("3001")
        account.save()
        client = Client()
        client.cookies["appj"] = make_app_user_token(account)
        response = client.post(f"/api/team-portal/teams/members/{outsider.pk}/absent/", data="{}", content_type="application/json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(AttendanceAbsenceMark.objects.filter(employee=outsider).exists())


class MobileRoleAndNotificationApiTests(TestCase):
    def setUp(self):
        self.manager = employee("Manager mobil", "MOBILE-M", "4001")
        self.account = AppUser(employee=self.manager, username="manager.mobil")
        self.account.set_pin("4001")
        self.account.save()
        self.team = EmployeeTeam.objects.create(name="Mobil", leader=self.manager, supervisor=self.manager)
        EmployeeTeamMember.objects.create(team=self.team, employee=self.manager)
        alert = TeamAttendanceAlert.objects.create(team=self.team, work_date=date(2026, 8, 27))
        alert.missing_employees.add(self.manager)
        self.recipient = TeamAttendanceAlertRecipient.objects.create(alert=alert, employee=self.manager)
        self.client = Client()
        self.identity = {"pin": "4001", "device_key": "android-test-device"}

    def post(self, path, extra=None):
        return self.client.post(path, data=json.dumps({**self.identity, **(extra or {})}), content_type="application/json")

    def test_dashboard_roles_teams_notifications_and_read_sync(self):
        dashboard = self.post("/api/mobile/employee-dashboard/")
        self.assertEqual(dashboard.status_code, 200, dashboard.content)
        access = dashboard.json()["access"]
        self.assertEqual(access["roles"], ["team_leader", "supervisor"])
        self.assertEqual(access["unread_notifications"], 1)

        teams = self.post("/api/mobile/teams/")
        self.assertEqual(teams.status_code, 200)
        self.assertEqual(teams.json()["teams"][0]["id"], self.team.pk)
        notifications = self.post("/api/mobile/notifications/")
        self.assertEqual(notifications.json()["unread_count"], 1)
        notification_id = notifications.json()["notifications"][0]["id"]
        read = self.post("/api/mobile/notifications/read/", {"notification_ids": [notification_id]})
        self.assertEqual(read.status_code, 200)
        self.assertEqual(read.json()["unread_count"], 0)

    def test_device_token_is_updated_without_duplicates(self):
        first = self.post("/api/mobile/device-token/", {"push_token": "token-one"})
        second = self.post("/api/mobile/device-token/", {"push_token": "token-two"})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(MobileDevice.objects.filter(employee=self.manager).count(), 1)
        self.assertEqual(MobileDevice.objects.get(employee=self.manager).push_token, "token-two")

    def test_invalid_firebase_token_is_deactivated(self):
        device = MobileDevice.objects.create(
            employee=self.manager,
            device_key="invalid-device",
            push_token="invalid-token",
        )

        class UnregisteredError(Exception):
            pass

        class FakeMessaging:
            Notification = staticmethod(lambda **values: values)
            AndroidNotification = staticmethod(lambda **values: values)
            AndroidConfig = staticmethod(lambda **values: values)
            Message = staticmethod(lambda **values: values)

            @staticmethod
            def send(message):
                raise UnregisteredError("invalid")

        with patch("ToolApp.push_notifications._firebase_messaging", return_value=FakeMessaging):
            result = send_employee_push([self.manager.pk], "Titlu", "Mesaj")
        device.refresh_from_db()
        self.assertEqual(result["invalid"], 1)
        self.assertFalse(device.active)
        self.assertIsNotNone(device.invalidated_at)
