import json
from datetime import date

from django.test import Client, TestCase

from ToolApp.mobile_services import build_ticket_benefit
from ToolApp.models import Users
from ToolApp.security import make_admin_token


class TicketBenefitCalculationTests(TestCase):
    def test_never_used_is_calculated_from_effective_hire_date(self):
        employee = Users.objects.create(
            UserName="Benefit Pending",
            UserSerie="BEN-001",
            hire_date=date(2025, 9, 3),
            ticket_benefit_enabled=True,
        )

        result = build_ticket_benefit(employee, date(2026, 9, 2))

        self.assertEqual(result["ticket_benefit_amount_eur"], "660.00")
        self.assertEqual(result["next_eligibility_date"], "2026-09-03")
        self.assertFalse(result["is_currently_eligible"])
        self.assertEqual(result["days_until_eligible"], 1)

    def test_last_trip_restarts_the_one_year_period(self):
        employee = Users.objects.create(
            UserName="Benefit Used",
            UserSerie="BEN-002",
            hire_date=date(2020, 1, 1),
            ticket_benefit_enabled=True,
            last_home_trip_date=date(2025, 10, 15),
        )

        result = build_ticket_benefit(employee, date(2026, 9, 2))

        self.assertEqual(result["next_eligibility_date"], "2026-10-15")
        self.assertEqual(result["days_until_eligible"], 43)
        self.assertFalse(result["is_currently_eligible"])

    def test_disabled_benefit_keeps_history_but_does_not_calculate_eligibility(self):
        employee = Users.objects.create(
            UserName="Benefit Disabled",
            UserSerie="BEN-003",
            ticket_benefit_enabled=False,
            last_home_trip_date=date(2025, 3, 10),
        )

        result = build_ticket_benefit(employee, date(2026, 9, 2))

        self.assertEqual(result["last_home_trip_date"], "2025-03-10")
        self.assertIsNone(result["next_eligibility_date"])
        self.assertIsNone(result["is_currently_eligible"])
        self.assertIsNone(result["days_until_eligible"])

    def test_leap_day_anniversary_is_supported(self):
        employee = Users.objects.create(
            UserName="Benefit Leap",
            UserSerie="BEN-004",
            hire_date=date(2024, 2, 29),
            ticket_benefit_enabled=True,
        )

        result = build_ticket_benefit(employee, date(2025, 2, 28))

        self.assertEqual(result["next_eligibility_date"], "2025-02-28")
        self.assertTrue(result["is_currently_eligible"])


class TicketBenefitApiTests(TestCase):
    def setUp(self):
        self.employee = Users.objects.create(
            UserName="Benefit API",
            UserSerie="BEN-API",
            hire_date=date(2020, 1, 1),
        )
        self.employee.set_pin("7319")
        self.employee.save()
        self.admin = Client()
        self.admin.cookies["ptj"] = make_admin_token()

    def test_admin_update_saves_fields_and_returns_backend_calculation(self):
        response = self.admin.put(
            "/api/user/",
            data=json.dumps({
                "UserId": self.employee.pk,
                "UserName": self.employee.UserName,
                "UserSerie": self.employee.UserSerie,
                "hourly_rate": "23.00",
                "ticket_benefit_enabled": True,
                "last_home_trip_date": None,
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertTrue(payload["ticket_benefit_enabled"])
        self.assertEqual(payload["ticket_benefit_amount_eur"], "660.00")
        self.assertTrue(payload["is_currently_eligible"])
        self.employee.refresh_from_db()
        self.assertTrue(self.employee.ticket_benefit_enabled)
        self.assertIsNone(self.employee.last_home_trip_date)

    def test_mobile_dashboard_exposes_the_same_values_flat_and_nested(self):
        self.employee.ticket_benefit_enabled = True
        self.employee.last_home_trip_date = date(2026, 1, 12)
        self.employee.save(update_fields=["ticket_benefit_enabled", "last_home_trip_date"])

        response = self.client.post(
            "/api/mobile/employee-dashboard/",
            data=json.dumps({"pin": "7319", "device_key": "ticket-test-device"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertEqual(payload["ticket_benefit"], {
            key: payload[key]
            for key in (
                "ticket_benefit_enabled",
                "last_home_trip_date",
                "ticket_benefit_amount_eur",
                "next_eligibility_date",
                "is_currently_eligible",
                "days_until_eligible",
            )
        })
