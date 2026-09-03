from datetime import date, datetime, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from ToolApp.models import AttendanceSession, EmployeeTeam, EmployeeTeamMember, LeaveDay, Users
from ToolApp.security import make_admin_token


class AdvancedAttendanceReportsTests(TestCase):
    def setUp(self):
        self.day = date(2026, 8, 20)
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {make_admin_token()}"}

    def aware(self, hour):
        return timezone.make_aware(datetime(2026, 8, 20, hour, 0))

    def test_cost_report_filters_worksite_and_groups_results(self):
        first = Users.objects.create(
            UserName="Primul Angajat", UserSerie="COST-1", Company="DMX", hourly_rate=Decimal("20.00")
        )
        second = Users.objects.create(
            UserName="Al Doilea", UserSerie="COST-2", Company="XUX", hourly_rate=Decimal("30.00")
        )
        AttendanceSession.objects.create(
            user_fk=first, work_date=self.day, in_time=self.aware(8), out_time=self.aware(12),
            duration_seconds=4 * 3600, worksite="The Lake Home Bloc A",
        )
        AttendanceSession.objects.create(
            user_fk=second, work_date=self.day, in_time=self.aware(8), out_time=self.aware(10),
            duration_seconds=2 * 3600, worksite="Bloc B2",
        )

        response = self.client.get("/api/pontaj/reports/costs/", {
            "start": self.day, "end": self.day, "worksite": "Bloc A",
        }, **self.auth)

        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertEqual(payload["summary"]["people_count"], 1)
        self.assertEqual(payload["summary"]["total_hms"], "04:00:00")
        self.assertEqual(payload["summary"]["total_cost"], "80.00")
        self.assertEqual(payload["companies"][0]["name"], "DMX")
        self.assertEqual(payload["worksites"][0]["name"], "The Lake Home Bloc A")
        self.assertEqual(payload["people"][0]["UserId"], first.pk)

    def test_absence_report_separates_leave_and_missing_attendance(self):
        leader = Users.objects.create(
            UserName="Șef", UserSerie="ABS-LEAD", attendance_exempt=True, hire_date=date(2026, 1, 1)
        )
        employee = Users.objects.create(
            UserName="Angajat absent", UserSerie="ABS-1", Company="DMX", hire_date=date(2026, 1, 1)
        )
        team = EmployeeTeam.objects.create(name="Echipa A", leader=leader, default_worksite="Tractorului Bloc A")
        EmployeeTeamMember.objects.create(team=team, employee=employee)
        AttendanceSession.objects.create(
            user_fk=employee, work_date=date(2026, 8, 17),
            in_time=self.aware(8) - timedelta(days=3), out_time=self.aware(16) - timedelta(days=3),
            duration_seconds=8 * 3600, worksite="Bloc A",
        )
        LeaveDay.objects.create(user_fk=employee, work_date=date(2026, 8, 18), reason=LeaveDay.Reason.CO)

        response = self.client.get("/api/pontaj/reports/absences/", {
            "start": "2026-08-17", "end": "2026-08-19", "company": "DMX", "worksite": "Bloc A",
        }, **self.auth)

        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertEqual(payload["summary"]["paid_leave"], 1)
        self.assertEqual(payload["summary"]["no_attendance"], 1)
        self.assertEqual({row["reason"] for row in payload["rows"]}, {"CO", "no_attendance"})
        self.assertTrue(all(row["worksite"] == "The Lake Home Bloc A" for row in payload["rows"]))

    def test_absence_report_counts_unexcused_in_without_attendance_even_after_check_in(self):
        employee = Users.objects.create(
            UserName="Absent pontat ulterior",
            UserSerie="ABS-LATE",
            Company="DMX",
            hire_date=date(2026, 1, 1),
        )
        AttendanceSession.objects.create(
            user_fk=employee,
            work_date=self.day,
            in_time=self.aware(10),
            out_time=self.aware(16),
            duration_seconds=6 * 3600,
            worksite="The Lake Home Bloc A",
        )
        LeaveDay.objects.create(
            user_fk=employee,
            work_date=self.day,
            reason=LeaveDay.Reason.UNEXCUSED,
        )

        response = self.client.get(
            "/api/pontaj/reports/absences/",
            {"start": self.day, "end": self.day, "company": "DMX"},
            **self.auth,
        )

        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertEqual(payload["summary"]["no_attendance"], 1)
        self.assertEqual(payload["summary"]["strict_no_attendance"], 0)
        self.assertEqual(payload["summary"]["unexcused_absence"], 1)
        self.assertEqual(payload["rows"][0]["reason"], LeaveDay.Reason.UNEXCUSED)

    def test_incomplete_report_only_returns_open_sessions(self):
        employee = Users.objects.create(UserName="Pontaj deschis", UserSerie="OPEN-1", Company="DMX")
        open_session = AttendanceSession.objects.create(
            user_fk=employee, work_date=self.day, in_time=self.aware(8), out_time=None, worksite="Bloc A"
        )
        AttendanceSession.objects.create(
            user_fk=employee, work_date=self.day, in_time=self.aware(9), out_time=self.aware(10),
            duration_seconds=3600, worksite="Bloc A",
        )

        response = self.client.get("/api/pontaj/reports/incomplete/", {
            "start": self.day, "end": self.day, "company": "DMX", "worksite": "Bloc A",
        }, **self.auth)

        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertEqual(payload["summary"]["sessions_count"], 1)
        self.assertEqual(payload["rows"][0]["id"], open_session.pk)
