import json
from datetime import datetime, timedelta
from decimal import Decimal

from django.test import Client, TestCase
from django.utils import timezone

from ToolApp.models import AttendanceSession, DailyPay, Users
from ToolApp.views import _make_admin_app_token


class AdminAttendanceNormalizationTests(TestCase):
    def setUp(self):
        self.employee = Users.objects.create(
            UserName="Angajat normalizare",
            UserSerie="NUCLEAR-1",
            hourly_rate=Decimal("100.00"),
        )
        self.client = Client()
        self.client.cookies["app_admin"] = _make_admin_app_token()

    def aware(self, year, month, day, hour, minute=0, second=0):
        return timezone.make_aware(datetime(year, month, day, hour, minute, second))

    def create_session(self, day, start_hour, duration_hours, start_minute=0):
        start = self.aware(day.year, day.month, day.day, start_hour, start_minute)
        duration_seconds = int(duration_hours * 3600)
        return AttendanceSession.objects.create(
            user_fk=self.employee,
            work_date=day,
            in_time=start,
            out_time=start + timedelta(seconds=duration_seconds),
            duration_seconds=duration_seconds,
        )

    def execute(self, confirmation="NUCLEAR BUTTON DO NOT PRESS"):
        return self.client.post(
            "/api/app-admin/attendance/normalize/",
            data=json.dumps({"confirmation": confirmation}),
            content_type="application/json",
        )

    def test_requires_admin_cookie_and_exact_confirmation(self):
        anonymous = Client().post(
            "/api/app-admin/attendance/normalize/",
            data=json.dumps({"confirmation": "NUCLEAR BUTTON DO NOT PRESS"}),
            content_type="application/json",
        )
        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(self.execute("wrong").status_code, 400)

    def test_reduces_daily_total_over_ten_hours_to_eight(self):
        day = datetime(2026, 9, 1).date()
        first = self.create_session(day, 7, 5)
        second = self.create_session(day, 12, 5)
        third = self.create_session(day, 17, 2)

        response = self.execute()

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["changed_days"], 1)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.duration_seconds, 5 * 3600)
        self.assertEqual(second.duration_seconds, 3 * 3600)
        self.assertEqual(second.out_time, second.in_time + timedelta(hours=3))
        self.assertFalse(AttendanceSession.objects.filter(pk=third.pk).exists())
        pay = DailyPay.objects.get(user_fk=self.employee, work_date=day)
        self.assertEqual(pay.total_seconds, 8 * 3600)
        self.assertEqual(pay.day_pay, Decimal("800.00"))

    def test_keeps_days_at_exactly_ten_hours_and_is_idempotent(self):
        day = datetime(2026, 9, 2).date()
        session = self.create_session(day, 7, 10)

        first_response = self.execute()
        second_response = self.execute()

        session.refresh_from_db()
        self.assertEqual(first_response.json()["changed_days"], 0)
        self.assertEqual(second_response.json()["changed_days"], 0)
        self.assertEqual(session.duration_seconds, 10 * 3600)
