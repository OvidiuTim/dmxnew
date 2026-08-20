import io
import json
import tempfile
from datetime import date, datetime
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from ToolApp.models import AttendanceSession, EmployeeTeam, PresenceEvent, Users
from ToolApp.security import make_admin_token
from ToolApp.worksites import ACCEPTED_WORKSITES, InvalidWorksite, match_worksite, normalize_worksite


class WorksiteNormalizationTests(TestCase):
    def test_requested_aliases_are_combined_case_and_diacritic_insensitively(self):
        examples = {
            " Bloc A ": "The Lake Home Bloc A",
            "Bl.A": "The Lake Home Bloc A",
            "TRACTORULUI": "The Lake Home Bloc A",
            "the lake home": "The Lake Home Bloc A",
            "bloc b 2": "The Lake Home Bloc B2",
            "The Lake Home Blocurile E si F": "The Lake Home Bloc E & F",
            "bloc F": "The Lake Home Bloc E & F",
            "c8 PSIHIATRIE": "Psihiatrie C8",
            "SIBIEL": "Sibiel - the river chalet",
            "gradinita   agnita": "Grădinița Agnita",
            "cisnădie": "Cisnadie",
        }
        for raw, expected in examples.items():
            with self.subTest(raw=raw):
                self.assertEqual(match_worksite(raw), expected)

    def test_unknown_worksite_is_rejected(self):
        with self.assertRaises(InvalidWorksite):
            normalize_worksite("Șantier inventat")

    def test_api_exposes_only_the_accepted_catalog(self):
        response = self.client.get(
            "/api/pontaj/worksites/",
            HTTP_AUTHORIZATION=f"Bearer {make_admin_token()}",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["worksites"], list(ACCEPTED_WORKSITES))

    def test_attendance_editor_rejects_unknown_and_saves_alias_as_canonical(self):
        employee = Users.objects.create(UserName="Editor pontaj", UserSerie="WS-EDIT-1")
        auth = {"HTTP_AUTHORIZATION": f"Bearer {make_admin_token()}"}
        base_payload = {
            "user_id": employee.pk,
            "date": "2026-06-15",
            "replace": True,
            "rewrite_presence": True,
        }

        rejected = self.client.post(
            "/api/pontaj/day/edit/",
            data=json.dumps({
                **base_payload,
                "sessions": [{"in": "08:00", "out": "16:00", "worksite": "Șantier inventat"}],
            }),
            content_type="application/json",
            **auth,
        )
        self.assertEqual(rejected.status_code, 400, rejected.content)
        self.assertEqual(rejected.json()["error_code"], "INVALID_WORKSITE")
        self.assertFalse(AttendanceSession.objects.filter(user_fk=employee).exists())

        accepted = self.client.post(
            "/api/pontaj/day/edit/",
            data=json.dumps({
                **base_payload,
                "sessions": [{"in": "08:00", "out": "16:00", "worksite": "tractorului bloc a"}],
            }),
            content_type="application/json",
            **auth,
        )
        self.assertEqual(accepted.status_code, 200, accepted.content)
        session = AttendanceSession.objects.get(user_fk=employee)
        self.assertEqual(session.worksite, "The Lake Home Bloc A")


class CleanupWorksitesCommandTests(TestCase):
    def setUp(self):
        self.employee = Users.objects.create(UserName="Angajat", UserSerie="CLEAN-1")
        self.unresolved_employee = Users.objects.create(UserName="Fără istoric", UserSerie="CLEAN-2")
        self.leader = Users.objects.create(UserName="Șef", UserSerie="CLEAN-L")
        self.day_one = date(2026, 6, 13)
        self.day_two = date(2026, 6, 14)
        self.first = AttendanceSession.objects.create(
            user_fk=self.employee, work_date=self.day_one,
            in_time=self._aware(2026, 6, 13, 8), out_time=self._aware(2026, 6, 13, 17),
            worksite="BIRou ingineri",
        )
        self.fallback = AttendanceSession.objects.create(
            user_fk=self.employee, work_date=self.day_two,
            in_time=self._aware(2026, 6, 14, 8), out_time=self._aware(2026, 6, 14, 17),
            worksite="locație imposibil de identificat",
        )
        self.unresolved = AttendanceSession.objects.create(
            user_fk=self.unresolved_employee, work_date=self.day_two,
            in_time=self._aware(2026, 6, 14, 8), out_time=self._aware(2026, 6, 14, 17),
            worksite="locație complet necunoscută",
        )
        self.event = PresenceEvent.objects.create(
            user_fk=self.employee, timestamp=self._aware(2026, 6, 14, 8),
            kind=PresenceEvent.Kind.ENTER, worksite="???",
        )
        self.team = EmployeeTeam.objects.create(
            name="Echipă curățare", leader=self.leader, default_worksite="Bloc F",
        )

    @staticmethod
    def _aware(year, month, day, hour):
        return timezone.make_aware(datetime(year, month, day, hour, 0))

    def test_preview_does_not_modify_data(self):
        output = io.StringIO()
        call_command("cleanup_worksites", stdout=output)
        self.fallback.refresh_from_db()
        self.assertEqual(self.fallback.worksite, "locație imposibil de identificat")
        self.assertIn("Nu s-a modificat baza de date", output.getvalue())

    def test_apply_creates_backup_and_uses_previous_day_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            output = io.StringIO()
            call_command("cleanup_worksites", apply=True, backup_dir=directory, stdout=output)

            self.first.refresh_from_db()
            self.fallback.refresh_from_db()
            self.unresolved.refresh_from_db()
            self.event.refresh_from_db()
            self.team.refresh_from_db()
            self.assertEqual(self.first.worksite, "Birou ingineri")
            self.assertEqual(self.fallback.worksite, "Birou ingineri")
            self.assertEqual(self.event.worksite, "Birou ingineri")
            self.assertEqual(self.team.default_worksite, "The Lake Home Bloc E & F")
            self.assertEqual(self.unresolved.worksite, "locație complet necunoscută")

            backups = list(Path(directory).glob("worksites-backup-*.json"))
            self.assertEqual(len(backups), 1)
            payload = json.loads(backups[0].read_text(encoding="utf-8"))
            self.assertTrue(payload["changes"])
            self.assertTrue(any(item["id"] == self.unresolved.id for item in payload["unresolved"]))
            self.assertIn("Standardizare finalizată", output.getvalue())
