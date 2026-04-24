from datetime import timedelta

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
