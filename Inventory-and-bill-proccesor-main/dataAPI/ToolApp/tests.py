from datetime import timedelta
import json
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from django.utils.timezone import localdate

from ToolApp.models import AttendanceSession, Users
from ToolApp.security import make_admin_token


class MonitorPontajTests(TestCase):
    def test_monitor_white_embeds_initial_events_for_existing_attendance(self):
        user = Users.objects.create(
            UserName="Ion Pop",
            UserSerie="SER-100",
        )
        now = timezone.now()
        AttendanceSession.objects.create(
            user_fk=user,
            work_date=localdate(now),
            in_time=now - timedelta(hours=2),
            out_time=now - timedelta(hours=1),
            duration_seconds=3600,
            source="nfc",
            worksite="Tractorului Bloc B2",
        )

        response = self.client.get("/pontaj/monitor/white/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "monitorInitialEvents")
        self.assertContains(response, "Ion Pop")
        self.assertContains(response, "Tractorului Bloc B2")

    def test_pontaj_stream_is_public_without_admin_login(self):
        response = self.client.get("/api/pontaj/stream/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/event-stream")


class ManualAttendanceSecurityTests(TestCase):
    def test_same_ip_different_devices_can_clock_in(self):
        first = Users(UserName="Muncitor 1", UserSerie="SER-201")
        first.set_pin("1201")
        first.save()

        second = Users(UserName="Muncitor 2", UserSerie="SER-202")
        second.set_pin("1202")
        second.save()

        base_payload = {
            "uid": "MANUAL",
            "tag_type": "manual",
            "timestamp": timezone.now().isoformat(),
            "worksite": "Tractorului Bloc B2",
            "gps": {"lat": 45.81, "lng": 24.13, "accuracy": 10},
            "mode": "manual",
        }

        first_response = self.client.post(
            "/api/pontaj/clock/",
            data=json.dumps({**base_payload, "pin": "1201", "device_key": "device-a"}),
            content_type="application/json",
            REMOTE_ADDR="1.2.3.4",
        )
        second_response = self.client.post(
            "/api/pontaj/clock/",
            data=json.dumps({**base_payload, "pin": "1202", "device_key": "device-b"}),
            content_type="application/json",
            REMOTE_ADDR="1.2.3.4",
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(first_response.json()["state"], "ENTER")
        self.assertEqual(second_response.json()["state"], "ENTER")

    def test_successful_pin_lookup_uses_plain_userpin(self):
        user = Users(UserName="Muncitor 3", UserSerie="SER-203")
        user.set_pin("5555")
        user.save()

        response = self.client.post(
            "/api/pontaj/login/",
            data=json.dumps({"pin": "5555", "device_key": "device-c", "uid": "MANUAL"}),
            content_type="application/json",
            REMOTE_ADDR="5.6.7.8",
        )

        user.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(user.UserPin, "5555")
        self.assertEqual(user.pin_hash, "")
        self.assertEqual(user.pin_lookup, "")


class AttendanceReportsTests(TestCase):
    def setUp(self):
        super().setUp()
        self.auth_header = {"HTTP_AUTHORIZATION": f"Bearer {make_admin_token()}"}

    def test_worksite_report_groups_known_aliases(self):
        user_one = Users.objects.create(UserName="Ion Pop", UserSerie="SER-301", Company="DMX")
        user_two = Users.objects.create(UserName="Vasile Ionescu", UserSerie="SER-302", Company="DMX")
        today = localdate()
        now = timezone.now()

        AttendanceSession.objects.create(
            user_fk=user_one,
            work_date=today,
            in_time=now - timedelta(hours=5),
            out_time=now - timedelta(hours=1),
            duration_seconds=4 * 3600,
            source="manual",
            worksite="Tractorului Bloc A",
        )
        AttendanceSession.objects.create(
            user_fk=user_two,
            work_date=today,
            in_time=now - timedelta(hours=4),
            out_time=now - timedelta(hours=2),
            duration_seconds=2 * 3600,
            source="manual",
            worksite="The Lake Home Bloc A",
        )

        response = self.client.get(
            f"/api/pontaj/reports/worksites/?start={today.isoformat()}&end={today.isoformat()}",
            **self.auth_header,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["worksites_count"], 1)
        self.assertEqual(payload["rows"][0]["worksite"], "Bloc A")
        self.assertEqual(payload["rows"][0]["people_count"], 2)
        self.assertEqual(payload["rows"][0]["total_seconds"], 6 * 3600)

    def test_day_cost_report_uses_hourly_rate_times_worked_hours(self):
        user = Users.objects.create(
            UserName="Mihai Popescu",
            UserSerie="SER-401",
            Company="DMX",
            hourly_rate=Decimal("25.50"),
        )
        today = localdate()
        now = timezone.now()

        AttendanceSession.objects.create(
            user_fk=user,
            work_date=today,
            in_time=now - timedelta(hours=3, minutes=30),
            out_time=now,
            duration_seconds=(3 * 3600) + (30 * 60),
            source="manual",
            worksite="Tractorului Bloc B2",
        )

        response = self.client.get(
            f"/api/pontaj/reports/day-cost/?date={today.isoformat()}",
            **self.auth_header,
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["people_count"], 1)
        self.assertEqual(payload["summary"]["total_hms"], "03:30:00")
        self.assertEqual(payload["summary"]["total_cost"], "89.25")
        self.assertEqual(payload["people"][0]["display_name"], "Mihai Popescu (SER-401)")
