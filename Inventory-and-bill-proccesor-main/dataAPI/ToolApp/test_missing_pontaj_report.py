from datetime import date

from django.test import SimpleTestCase

from ToolApp.management.commands.send_missing_pontaj_report import (
    build_html,
    build_text,
    group_users_by_company,
)


class StubUser:
    def __init__(self, name, serie, company):
        self.UserName = name
        self.UserSerie = serie
        self.Company = company


class MissingPontajReportTests(SimpleTestCase):
    def setUp(self):
        self.users = [
            StubUser("Victor", "VB-2", "VB-ROM"),
            StubUser("Dan", "DMX-1", "DMX"),
            StubUser("Ana", "VB-1", "VB-ROM"),
            StubUser("Necunoscut", "N-1", None),
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
