import io
import json
from datetime import date

from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone
from openpyxl import load_workbook

from ToolApp.employee_retention import purge_expired_dismissed_employees
from ToolApp.models import AttendanceSession, Histories, Users
from ToolApp.security import make_admin_token
from ToolApp.views import _find_user_by_pin


class EmployeeDismissalTests(TestCase):
    def setUp(self):
        self.admin = Client()
        self.admin.cookies["ptj"] = make_admin_token()
        self.employee = Users(UserName="Angajat demis", UserSerie="DISMISSED-1", hourly_rate="25.00")
        self.employee.set_pin("7744")
        self.employee.save()

    def test_employee_can_be_marked_dismissed_without_immediate_deletion(self):
        response = self.admin.put(
            "/api/user/",
            data=json.dumps({
                "UserId": self.employee.pk,
                "UserName": self.employee.UserName,
                "UserSerie": self.employee.UserSerie,
                "employment_status": "dismissed",
                "dismissed_at": "2026-08-14",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.employment_status, Users.EmploymentStatus.DISMISSED)
        self.assertEqual(self.employee.dismissed_at, date(2026, 8, 14))
        self.assertFalse(self.employee.active)
        self.assertIsNone(_find_user_by_pin("7744"))
        self.assertTrue(Users.objects.filter(pk=self.employee.pk).exists())

    def test_reports_ignore_activity_after_dismissal_but_keep_history_before_it(self):
        self.employee.employment_status = Users.EmploymentStatus.DISMISSED
        self.employee.dismissed_at = date(2026, 8, 10)
        self.employee.active = False
        self.employee.save(update_fields=("employment_status", "dismissed_at", "active"))
        for work_date, worksite in ((date(2026, 8, 9), "Istoric"), (date(2026, 8, 11), "După demitere")):
            AttendanceSession.objects.create(
                user_fk=self.employee,
                work_date=work_date,
                in_time=timezone.now(),
                out_time=timezone.now(),
                duration_seconds=3600,
                worksite=worksite,
            )

        worksite_report = self.admin.get(
            reverse("attendance_worksite_report"),
            {"start": "2026-08-01", "end": "2026-08-31"},
        )
        self.assertEqual(worksite_report.status_code, 200, worksite_report.content)
        self.assertEqual([row["worksite"] for row in worksite_report.json()["rows"]], ["Istoric"])

        after_day = self.admin.get(reverse("attendance_day"), {"date": "2026-08-11"})
        self.assertEqual(after_day.status_code, 200, after_day.content)
        self.assertFalse(any(row["UserId"] == self.employee.pk for row in after_day.json()["rows"]))

    def test_excel_after_dismissal_does_not_include_employee(self):
        Users.objects.create(UserName="Angajat activ", UserSerie="ACTIVE-EXCEL")
        self.employee.employment_status = Users.EmploymentStatus.DISMISSED
        self.employee.dismissed_at = date(2026, 8, 10)
        self.employee.active = False
        self.employee.save(update_fields=("employment_status", "dismissed_at", "active"))

        response = self.admin.post(
            reverse("pontaj_excel"),
            data=json.dumps({"month": "2026-09"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content[:300])
        workbook = load_workbook(io.BytesIO(response.content), data_only=False)
        names = [str(cell.value or "") for cell in workbook.active["B"]]
        workbook.close()
        self.assertFalse(any("Angajat demis" in value for value in names))
        self.assertTrue(any("Angajat activ" in value for value in names))

    def test_expired_dismissed_employee_is_deleted_after_two_years(self):
        self.employee.employment_status = Users.EmploymentStatus.DISMISSED
        self.employee.dismissed_at = date(2024, 8, 14)
        self.employee.active = False
        self.employee.save(update_fields=("employment_status", "dismissed_at", "active"))
        AttendanceSession.objects.create(user_fk=self.employee, work_date=date(2024, 8, 14))
        Histories.objects.create(user_fk=self.employee, User=self.employee.UserName)
        retained = Users.objects.create(
            UserName="Demis încă în retenție",
            UserSerie="DISMISSED-RETAINED",
            employment_status=Users.EmploymentStatus.DISMISSED,
            dismissed_at=date(2024, 8, 15),
            active=False,
        )

        purged = purge_expired_dismissed_employees(reference_date=date(2026, 8, 14))

        self.assertEqual([employee.pk for employee in purged], [self.employee.pk])
        self.assertFalse(Users.objects.filter(pk=self.employee.pk).exists())
        self.assertTrue(Users.objects.filter(pk=retained.pk).exists())
        history = Histories.objects.get()
        self.assertIsNone(history.user_fk_id)
        self.assertEqual(history.User, "Angajat șters")
