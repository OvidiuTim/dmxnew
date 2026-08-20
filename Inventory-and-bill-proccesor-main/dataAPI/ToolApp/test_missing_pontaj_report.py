from datetime import date, datetime, time, timedelta
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from ToolApp.management.commands.send_missing_pontaj_report import (
    OpenCheckoutRow,
    build_html,
    build_text,
    get_consecutive_missing_user_ids,
    get_missing_users_for_day,
    get_open_checkouts_for_day,
    group_users_by_company,
)
from ToolApp.models import AttendanceSession, LeaveDay, Users


class StubUser:
    def __init__(self, name, serie, company, user_id=None):
        self.UserId = user_id
        self.UserName = name
        self.UserSerie = serie
        self.Company = company


class MissingPontajReportTests(SimpleTestCase):
    def setUp(self):
        self.users = [
            StubUser("Victor", "VB-2", "VB-ROM", 1),
            StubUser("Dan", "DMX-1", "DMX", 2),
            StubUser("Ana", "VB-1", "VB-ROM", 3),
            StubUser("Necunoscut", "N-1", None, 4),
        ]

    def test_groups_users_by_company_and_places_missing_company_last(self):
        groups = group_users_by_company(self.users)

        self.assertEqual(list(groups), ["DMX", "VB-ROM", "Fără firmă"])
        self.assertEqual([user.UserName for user in groups["VB-ROM"]], ["Victor", "Ana"])

    def test_html_contains_one_section_and_count_per_company(self):
        html = build_html(date(2026, 8, 3), self.users)

        self.assertIn("DMX — lipsă: 1", html)
        self.assertIn("VB-ROM — lipsă: 2", html)
        self.assertIn("Fără firmă — lipsă: 1", html)
        self.assertEqual(html.count("<table"), 3)

    def test_text_contains_company_sections(self):
        text = build_text(date(2026, 8, 3), self.users)

        self.assertIn("Angajați fără pontaj și fără leave înregistrat: 4", text)
        self.assertIn("DMX — lipsă: 1\n1. Dan | Serie: DMX-1", text)
        self.assertIn("VB-ROM — lipsă: 2", text)

    def test_html_escapes_employee_data(self):
        html = build_html(
            date(2026, 8, 3),
            [StubUser("<script>alert(1)</script>", "A&B", "DMX")],
        )

        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", html)
        self.assertIn("A&amp;B", html)

    def test_three_day_warning_is_large_red_and_visible_in_both_formats(self):
        html = build_html(date(2026, 8, 14), self.users, {1})
        text = build_text(date(2026, 8, 14), self.users, {1})

        self.assertIn("Nu s-a pontat 3 zile la rând", html)
        self.assertIn("color:#d00000", html)
        self.assertIn("font-size:20px", html)
        self.assertIn("Victor | Serie: VB-2 | ATENȚIE: Nu s-a pontat 3 zile la rând", text)

    def test_open_checkouts_are_grouped_by_company(self):
        session = type(
            "StubSession",
            (),
            {
                "in_time": timezone.make_aware(datetime(2026, 8, 14, 7, 30)),
                "worksite": "Șantier Nord",
            },
        )()
        open_checkouts = [OpenCheckoutRow(user=self.users[1], sessions=[session])]

        html = build_html(date(2026, 8, 14), [], open_checkouts=open_checkouts)
        text = build_text(date(2026, 8, 14), [], open_checkouts=open_checkouts)

        self.assertIn("Check-in fără check-out — 1", html)
        self.assertIn("DMX — fără check-out: 1", html)
        self.assertIn("Dan", html)
        self.assertIn("07:30", html)
        self.assertIn("Șantier Nord", html)
        self.assertIn("DMX — fără check-out: 1", text)

    @patch("ToolApp.management.commands.send_missing_pontaj_report.send_email")
    def test_sunday_report_is_skipped_without_sending_email(self, send_email_mock):
        output = StringIO()

        call_command(
            "send_missing_pontaj_report",
            date="2026-08-16",
            stdout=output,
        )

        send_email_mock.assert_not_called()
        self.assertIn("duminica nu este zi lucrătoare", output.getvalue())


class MissingPontajReportQueryTests(TestCase):
    target_day = date(2026, 8, 14)

    def create_user(self, name, serie, **extra):
        return Users.objects.create(UserName=name, UserSerie=serie, Company="DMX", **extra)

    def attendance(self, user, work_day, *, open_session=False, hour=7):
        in_time = timezone.make_aware(datetime.combine(work_day, time(hour, 0)))
        return AttendanceSession.objects.create(
            user_fk=user,
            work_date=work_day,
            in_time=in_time,
            out_time=None if open_session else in_time + timedelta(hours=8),
            worksite="Șantier Test",
        )

    def test_consecutive_missing_requires_three_workdays_without_attendance_or_leave(self):
        flagged = self.create_user("Trei zile lipsă", "DMX-100")
        attendance_break = self.create_user("Pontat ieri", "DMX-101")
        leave_break = self.create_user("Concediu ieri", "DMX-102")
        self.attendance(attendance_break, date(2026, 8, 13))
        LeaveDay.objects.create(
            user_fk=leave_break,
            work_date=date(2026, 8, 13),
            reason=LeaveDay.Reason.CO,
        )

        missing_users = get_missing_users_for_day(self.target_day)
        flagged_ids = get_consecutive_missing_user_ids(self.target_day, missing_users)

        self.assertIn(flagged.UserId, flagged_ids)
        self.assertNotIn(attendance_break.UserId, flagged_ids)
        self.assertNotIn(leave_break.UserId, flagged_ids)

    def test_report_queries_only_active_employees_and_consolidates_open_sessions(self):
        open_user = self.create_user("Fără ieșire", "DMX-200")
        self.attendance(open_user, self.target_day, open_session=True, hour=7)
        self.attendance(open_user, self.target_day, open_session=True, hour=9)
        collaborator = self.create_user(
            "Colaborator",
            "DMX-COL",
            person_type=Users.PersonType.COLLABORATOR,
        )
        dismissed = self.create_user(
            "Demis",
            "DMX-DEM",
            active=False,
            employment_status=Users.EmploymentStatus.DISMISSED,
            dismissed_at=self.target_day,
        )
        self.attendance(collaborator, self.target_day, open_session=True)
        self.attendance(dismissed, self.target_day, open_session=True)

        missing_users = get_missing_users_for_day(self.target_day)
        open_checkouts = get_open_checkouts_for_day(self.target_day)

        self.assertNotIn(collaborator, missing_users)
        self.assertNotIn(dismissed, missing_users)
        self.assertEqual(len(open_checkouts), 1)
        self.assertEqual(open_checkouts[0].user, open_user)
        self.assertEqual(len(open_checkouts[0].sessions), 2)

    def test_attendance_exempt_employee_is_omitted_from_missing_and_open_checkout_lists(self):
        exempt_missing = self.create_user("Nu se pontează", "DMX-EX-1", attendance_exempt=True)
        exempt_open = self.create_user("Pontaj exceptat", "DMX-EX-2", attendance_exempt=True)
        self.attendance(exempt_open, self.target_day, open_session=True)

        self.assertNotIn(exempt_missing, get_missing_users_for_day(self.target_day))
        self.assertNotIn(exempt_open, [row.user for row in get_open_checkouts_for_day(self.target_day)])
