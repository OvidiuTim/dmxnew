import json
from datetime import date
from decimal import Decimal

from django.test import Client, TestCase

from ToolApp.mobile_services import (
    TICKET_BENEFIT_DEFAULT_AMOUNT_EUR,
    ZILE_CONCEDIU_NECESARE_BILET,
    build_team_leader_bonus,
    build_ticket_benefit,
)
from ToolApp.models import EmployeeTeam, Users
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
                "monthly_rate",
                "next_eligibility_date",
                "is_currently_eligible",
                "days_until_eligible",
                "accrued_amount",
                "completed_months",
                "leave_days_available",
                "required_leave_days",
                "has_enough_leave_days",
            )
        })


class TicketBenefitAccrualTests(TestCase):
    """Acumularea lunara, plafonarea si campurile informative de concediu."""

    def _employee(self, **kwargs):
        kwargs.setdefault("UserName", "Benefit Accrual")
        kwargs.setdefault("UserSerie", f"ACC-{Users.objects.count() + 1:03d}")
        kwargs.setdefault("ticket_benefit_enabled", True)
        return Users.objects.create(**kwargs)

    def test_monthly_rate_is_derived_from_the_configured_amount(self):
        employee = self._employee(hire_date=date(2026, 1, 1))

        result = build_ticket_benefit(employee, date(2026, 3, 1))

        self.assertEqual(result["monthly_rate"], f"{TICKET_BENEFIT_DEFAULT_AMOUNT_EUR / 12:.2f}")

    def test_accrual_is_proportional_to_completed_months(self):
        employee = self._employee(hire_date=date(2026, 1, 10))

        # 4 luni complete la 10 mai: februarie, martie, aprilie, mai nu -> 10.05 = 4 luni
        result = build_ticket_benefit(employee, date(2026, 5, 10))

        self.assertEqual(result["completed_months"], 4)
        self.assertEqual(result["accrued_amount"], "220.00")

    def test_partial_month_does_not_count(self):
        employee = self._employee(hire_date=date(2026, 1, 10))

        result = build_ticket_benefit(employee, date(2026, 5, 9))

        self.assertEqual(result["completed_months"], 3)
        self.assertEqual(result["accrued_amount"], "165.00")

    def test_accrual_is_capped_at_twelve_months(self):
        employee = self._employee(hire_date=date(2020, 3, 15))

        result = build_ticket_benefit(employee, date(2026, 9, 7))

        self.assertEqual(result["completed_months"], 12)
        self.assertEqual(result["accrued_amount"], f"{TICKET_BENEFIT_DEFAULT_AMOUNT_EUR:.2f}")
        self.assertTrue(result["is_currently_eligible"])

    def test_accrual_does_not_reset_on_january_first(self):
        """Bonusul nu foloseste completed_full_months, care se reseteaza anual."""
        employee = self._employee(hire_date=date(2025, 7, 15))

        result = build_ticket_benefit(employee, date(2026, 1, 20))

        self.assertEqual(result["completed_months"], 6)
        self.assertEqual(result["accrued_amount"], "330.00")

    def test_last_trip_home_resets_the_accrual(self):
        employee = self._employee(
            hire_date=date(2020, 1, 1),
            last_home_trip_date=date(2026, 6, 7),
        )

        result = build_ticket_benefit(employee, date(2026, 9, 7))

        self.assertEqual(result["completed_months"], 3)
        self.assertEqual(result["accrued_amount"], "165.00")
        self.assertEqual(result["next_eligibility_date"], "2027-06-07")

    def test_hire_date_wins_when_it_is_later_than_the_last_trip(self):
        employee = self._employee(
            hire_date=date(2026, 3, 1),
            last_home_trip_date=date(2025, 1, 1),
        )

        result = build_ticket_benefit(employee, date(2026, 9, 1))

        self.assertEqual(result["completed_months"], 6)
        self.assertEqual(result["next_eligibility_date"], "2027-03-01")

    def test_leap_day_start_is_fully_accrued_on_the_anniversary(self):
        employee = self._employee(hire_date=date(2024, 2, 29))

        result = build_ticket_benefit(employee, date(2025, 2, 28))

        self.assertTrue(result["is_currently_eligible"])
        self.assertEqual(result["completed_months"], 12)
        self.assertEqual(result["accrued_amount"], f"{TICKET_BENEFIT_DEFAULT_AMOUNT_EUR:.2f}")

    def test_disabled_benefit_has_no_accrual(self):
        employee = self._employee(hire_date=date(2020, 1, 1), ticket_benefit_enabled=False)

        result = build_ticket_benefit(employee, date(2026, 9, 7))

        self.assertIsNone(result["accrued_amount"])
        self.assertIsNone(result["completed_months"])
        self.assertEqual(result["monthly_rate"], f"{TICKET_BENEFIT_DEFAULT_AMOUNT_EUR / 12:.2f}")


class TicketBenefitLeaveDaysTests(TestCase):
    """Zilele de concediu sunt informative: nu ating niciodata is_currently_eligible."""

    def _employee(self, **kwargs):
        kwargs.setdefault("UserName", "Benefit Leave")
        kwargs.setdefault("UserSerie", f"LEA-{Users.objects.count() + 1:03d}")
        kwargs.setdefault("ticket_benefit_enabled", True)
        return Users.objects.create(**kwargs)

    def test_without_leave_summary_the_fields_stay_null(self):
        employee = self._employee(hire_date=date(2020, 1, 1))

        result = build_ticket_benefit(employee, date(2026, 9, 7))

        self.assertIsNone(result["leave_days_available"])
        self.assertIsNone(result["required_leave_days"])
        self.assertIsNone(result["has_enough_leave_days"])

    def test_leave_summary_is_reported_without_extra_queries(self):
        employee = self._employee(hire_date=date(2020, 1, 1))

        with self.assertNumQueries(0):
            result = build_ticket_benefit(
                employee,
                date(2026, 9, 7),
                leave_summary={"remaining_days": "8.50"},
            )

        self.assertEqual(result["leave_days_available"], "8.50")
        self.assertEqual(result["required_leave_days"], f"{ZILE_CONCEDIU_NECESARE_BILET:g}")
        self.assertFalse(result["has_enough_leave_days"])

    def test_enough_leave_days_is_true_at_the_threshold(self):
        employee = self._employee(hire_date=date(2020, 1, 1))

        result = build_ticket_benefit(
            employee,
            date(2026, 9, 7),
            leave_summary={"remaining_days": f"{ZILE_CONCEDIU_NECESARE_BILET:.2f}"},
        )

        self.assertTrue(result["has_enough_leave_days"])

    def test_negative_leave_balance_is_reported_as_is(self):
        employee = self._employee(hire_date=date(2020, 1, 1))

        result = build_ticket_benefit(
            employee,
            date(2026, 9, 7),
            leave_summary={"remaining_days": "-2.00"},
        )

        self.assertEqual(result["leave_days_available"], "-2.00")
        self.assertFalse(result["has_enough_leave_days"])

    def test_insufficient_leave_days_do_not_block_eligibility(self):
        """Badge-ul ramane pe 2 stari: zilele de concediu nu il influenteaza."""
        employee = self._employee(hire_date=date(2020, 1, 1))

        fara_zile = build_ticket_benefit(
            employee, date(2026, 9, 7), leave_summary={"remaining_days": "0.00"}
        )
        cu_zile = build_ticket_benefit(
            employee, date(2026, 9, 7), leave_summary={"remaining_days": "21.00"}
        )

        self.assertTrue(fara_zile["is_currently_eligible"])
        self.assertTrue(cu_zile["is_currently_eligible"])
        self.assertFalse(fara_zile["has_enough_leave_days"])
        self.assertTrue(cu_zile["has_enough_leave_days"])

    def test_not_eligible_yet_keeps_the_two_state_badge(self):
        employee = self._employee(hire_date=date(2026, 3, 1))

        result = build_ticket_benefit(
            employee, date(2026, 9, 7), leave_summary={"remaining_days": "21.00"}
        )

        self.assertFalse(result["is_currently_eligible"])
        self.assertTrue(result["has_enough_leave_days"])
        self.assertEqual(result["days_until_eligible"], 175)


class TicketBenefitPerEmployeeAmountTests(TestCase):
    """Suma bonusului poate fi setata pe angajat; constanta ramane doar fallback."""

    def test_null_amount_falls_back_to_the_default_constant(self):
        employee = Users.objects.create(
            UserName="Suma Implicita",
            UserSerie="SUM-001",
            hire_date=date(2026, 1, 1),
            ticket_benefit_enabled=True,
        )

        result = build_ticket_benefit(employee, date(2026, 7, 1))

        self.assertIsNone(employee.suma_bonus_bilet_eur)
        self.assertEqual(
            result["ticket_benefit_amount_eur"], f"{TICKET_BENEFIT_DEFAULT_AMOUNT_EUR:.2f}"
        )
        self.assertEqual(result["monthly_rate"], "55.00")
        self.assertEqual(result["accrued_amount"], "330.00")

    def test_employee_amount_drives_rate_and_accrual(self):
        employee = Users.objects.create(
            UserName="Suma Proprie",
            UserSerie="SUM-002",
            hire_date=date(2026, 1, 1),
            ticket_benefit_enabled=True,
            suma_bonus_bilet_eur=Decimal("1200.00"),
        )

        result = build_ticket_benefit(employee, date(2026, 7, 1))

        self.assertEqual(result["ticket_benefit_amount_eur"], "1200.00")
        self.assertEqual(result["monthly_rate"], "100.00")
        self.assertEqual(result["accrued_amount"], "600.00")

    def test_employee_amount_is_the_accrual_cap(self):
        employee = Users.objects.create(
            UserName="Suma Plafon",
            UserSerie="SUM-003",
            hire_date=date(2020, 1, 1),
            ticket_benefit_enabled=True,
            suma_bonus_bilet_eur=Decimal("500.00"),
        )

        result = build_ticket_benefit(employee, date(2026, 9, 7))

        self.assertEqual(result["accrued_amount"], "500.00")


class TeamLeaderBonusTests(TestCase):
    """Bonusul de sef de echipa: rol din echipele active, acumulare doar cu data de start."""

    def _leader(self, **kwargs):
        kwargs.setdefault("UserName", "Sef Echipa")
        kwargs.setdefault("UserSerie", f"SEF-{Users.objects.count() + 1:03d}")
        employee = Users.objects.create(**kwargs)
        EmployeeTeam.objects.create(name=f"Echipa {employee.pk}", leader=employee, active=True)
        return employee

    def test_employee_without_an_active_team_is_not_a_leader(self):
        employee = Users.objects.create(
            UserName="Membru Simplu",
            UserSerie="MEM-001",
            bonus_lunar_sef_echipa=Decimal("100.00"),
            data_start_sef_echipa=date(2025, 1, 1),
        )

        result = build_team_leader_bonus(employee, date(2026, 9, 7))

        self.assertFalse(result["is_team_leader"])
        self.assertIsNone(result["monthly_amount"])
        self.assertIsNone(result["accrued_amount"])

    def test_leader_without_start_date_reports_only_the_monthly_amount(self):
        employee = self._leader(bonus_lunar_sef_echipa=Decimal("100.00"))

        result = build_team_leader_bonus(employee, date(2026, 9, 7))

        self.assertTrue(result["is_team_leader"])
        self.assertEqual(result["monthly_amount"], "100.00")
        self.assertIsNone(result["accrued_amount"])
        self.assertIsNone(result["completed_months"])
        self.assertTrue(result["needs_start_date"])

    def test_leader_without_configured_amount_has_no_bonus(self):
        employee = self._leader(data_start_sef_echipa=date(2026, 1, 1))

        result = build_team_leader_bonus(employee, date(2026, 9, 7))

        self.assertTrue(result["is_team_leader"])
        self.assertIsNone(result["monthly_amount"])
        self.assertFalse(result["needs_start_date"])

    def test_accrual_runs_from_the_leadership_start_date(self):
        employee = self._leader(
            bonus_lunar_sef_echipa=Decimal("100.00"),
            data_start_sef_echipa=date(2026, 3, 10),
        )

        result = build_team_leader_bonus(employee, date(2026, 9, 10))

        self.assertEqual(result["start_date"], "2026-03-10")
        self.assertEqual(result["completed_months"], 6)
        self.assertEqual(result["accrued_amount"], "600.00")
        self.assertFalse(result["needs_start_date"])

    def test_last_payment_restarts_the_accrual(self):
        employee = self._leader(
            bonus_lunar_sef_echipa=Decimal("100.00"),
            data_start_sef_echipa=date(2024, 1, 1),
            data_ultimei_plati_bonus_sef=date(2026, 6, 7),
        )

        result = build_team_leader_bonus(employee, date(2026, 9, 7))

        self.assertEqual(result["start_date"], "2026-06-07")
        self.assertEqual(result["last_payment_date"], "2026-06-07")
        self.assertEqual(result["completed_months"], 3)
        self.assertEqual(result["accrued_amount"], "300.00")

    def test_payment_older_than_the_start_date_is_ignored(self):
        employee = self._leader(
            bonus_lunar_sef_echipa=Decimal("100.00"),
            data_start_sef_echipa=date(2026, 3, 1),
            data_ultimei_plati_bonus_sef=date(2025, 12, 1),
        )

        result = build_team_leader_bonus(employee, date(2026, 9, 1))

        self.assertEqual(result["start_date"], "2026-03-01")
        self.assertEqual(result["completed_months"], 6)

    def test_accrual_does_not_reset_on_january_first(self):
        employee = self._leader(
            bonus_lunar_sef_echipa=Decimal("100.00"),
            data_start_sef_echipa=date(2025, 7, 15),
        )

        result = build_team_leader_bonus(employee, date(2026, 1, 20))

        self.assertEqual(result["completed_months"], 6)
        self.assertEqual(result["accrued_amount"], "600.00")

    def test_leader_bonus_does_not_touch_the_ticket_benefit(self):
        employee = self._leader(
            hire_date=date(2026, 1, 1),
            ticket_benefit_enabled=True,
            bonus_lunar_sef_echipa=Decimal("100.00"),
            data_start_sef_echipa=date(2026, 1, 1),
        )

        ticket = build_ticket_benefit(employee, date(2026, 7, 1))
        leader = build_team_leader_bonus(employee, date(2026, 7, 1))

        self.assertEqual(ticket["accrued_amount"], "330.00")
        self.assertEqual(leader["accrued_amount"], "600.00")
        self.assertEqual(
            ticket["ticket_benefit_amount_eur"], f"{TICKET_BENEFIT_DEFAULT_AMOUNT_EUR:.2f}"
        )
