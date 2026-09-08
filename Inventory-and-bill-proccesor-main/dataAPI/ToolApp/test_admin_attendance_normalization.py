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

    def test_cuts_one_hour_in_the_morning_and_the_rest_in_the_evening(self):
        """Zi de 12 ore: o ora de la venire, restul de 3 ore de la plecare."""
        day = datetime(2026, 9, 1).date()
        first = self.create_session(day, 7, 5)
        second = self.create_session(day, 12, 5)
        third = self.create_session(day, 17, 2)

        response = self.execute()

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["changed_days"], 1)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.in_time, self.aware(2026, 9, 1, 8))
        self.assertEqual(first.out_time, self.aware(2026, 9, 1, 12))
        self.assertEqual(first.duration_seconds, 4 * 3600)
        self.assertEqual(second.in_time, self.aware(2026, 9, 1, 12))
        self.assertEqual(second.out_time, self.aware(2026, 9, 1, 16))
        self.assertEqual(second.duration_seconds, 4 * 3600)
        self.assertFalse(AttendanceSession.objects.filter(pk=third.pk).exists())
        pay = DailyPay.objects.get(user_fk=self.employee, work_date=day)
        self.assertEqual(pay.total_seconds, 8 * 3600)
        self.assertEqual(pay.day_pay, Decimal("800.00"))

    def test_the_standard_ten_hour_day_becomes_half_past_eight_to_half_past_four(self):
        """07:30-17:30 este programul normal si devine 08:30-16:30."""
        day = datetime(2026, 9, 2).date()
        session = self.create_session(day, 7, 10, start_minute=30)

        response = self.execute()

        self.assertEqual(response.json()["changed_days"], 1)
        session.refresh_from_db()
        self.assertEqual(session.in_time, self.aware(2026, 9, 2, 8, 30))
        self.assertEqual(session.out_time, self.aware(2026, 9, 2, 16, 30))
        self.assertEqual(session.duration_seconds, 8 * 3600)

    def test_a_surplus_under_one_hour_is_taken_only_from_the_morning(self):
        day = datetime(2026, 9, 7).date()
        session = self.create_session(day, 7, 8.5)

        self.execute()

        session.refresh_from_db()
        self.assertEqual(session.in_time, self.aware(2026, 9, 7, 7, 30))
        self.assertEqual(session.out_time, self.aware(2026, 9, 7, 15, 30))
        self.assertEqual(session.duration_seconds, 8 * 3600)

    def test_a_short_first_session_is_consumed_by_the_morning_cut(self):
        """Daca prima sesiune e mai scurta de o ora, se sterge si taierea continua."""
        day = datetime(2026, 9, 8).date()
        short = self.create_session(day, 7, 0.5)
        main = self.create_session(day, 8, 10)

        self.execute()

        main.refresh_from_db()
        self.assertFalse(AttendanceSession.objects.filter(pk=short.pk).exists())
        self.assertEqual(main.in_time, self.aware(2026, 9, 8, 8, 30))
        self.assertEqual(main.out_time, self.aware(2026, 9, 8, 16, 30))
        self.assertEqual(main.duration_seconds, 8 * 3600)

    def test_keeps_days_at_or_below_eight_hours_and_is_idempotent(self):
        exact = datetime(2026, 9, 3).date()
        short = datetime(2026, 9, 4).date()
        exact_session = self.create_session(exact, 7, 8)
        short_session = self.create_session(short, 7, 6.5)

        first_response = self.execute()
        second_response = self.execute()

        exact_session.refresh_from_db()
        short_session.refresh_from_db()
        self.assertEqual(first_response.json()["changed_days"], 0)
        self.assertEqual(second_response.json()["changed_days"], 0)
        self.assertEqual(exact_session.duration_seconds, 8 * 3600)
        self.assertEqual(short_session.duration_seconds, int(6.5 * 3600))

    def test_running_it_twice_changes_nothing_the_second_time(self):
        day = datetime(2026, 9, 5).date()
        self.create_session(day, 7, 11)

        first_response = self.execute()
        second_response = self.execute()

        self.assertEqual(first_response.json()["changed_days"], 1)
        self.assertEqual(second_response.json()["changed_days"], 0)

    def test_covers_every_employee_and_every_month(self):
        colleague = Users.objects.create(
            UserName="Alt angajat",
            UserSerie="NUCLEAR-2",
            hourly_rate=Decimal("50.00"),
        )
        january = datetime(2025, 1, 15).date()
        august = datetime(2026, 8, 20).date()
        mine = self.create_session(january, 7, 9)
        start = self.aware(august.year, august.month, august.day, 6)
        theirs = AttendanceSession.objects.create(
            user_fk=colleague,
            work_date=august,
            in_time=start,
            out_time=start + timedelta(hours=12),
            duration_seconds=12 * 3600,
        )

        response = self.execute()

        self.assertEqual(response.json()["changed_days"], 2)
        mine.refresh_from_db()
        theirs.refresh_from_db()
        self.assertEqual(mine.duration_seconds, 8 * 3600)
        self.assertEqual(theirs.duration_seconds, 8 * 3600)
        self.assertEqual(
            DailyPay.objects.get(user_fk=colleague, work_date=august).day_pay,
            Decimal("400.00"),
        )

    def test_open_sessions_without_checkout_are_left_alone(self):
        day = datetime(2026, 9, 6).date()
        start = self.aware(day.year, day.month, day.day, 7)
        open_session = AttendanceSession.objects.create(
            user_fk=self.employee,
            work_date=day,
            in_time=start,
            out_time=None,
            duration_seconds=0,
        )

        response = self.execute()

        open_session.refresh_from_db()
        self.assertEqual(response.json()["changed_days"], 0)
        self.assertIsNone(open_session.out_time)
