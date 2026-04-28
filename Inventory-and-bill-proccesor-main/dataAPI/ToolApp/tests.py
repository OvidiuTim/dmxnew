from datetime import timedelta
import json

from django.test import TestCase
from django.utils import timezone
from django.utils.timezone import localdate

from ToolApp.models import AttendanceSession, Users


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
