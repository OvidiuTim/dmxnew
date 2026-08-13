import json
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from ToolApp.mobile_services import (
    accrued_leave_days,
    build_leave_summary,
    build_inventory,
    build_monthly_attendance,
    build_salary_payments,
    build_team,
    calculate_available_leave_days,
    calculate_payroll,
    completed_full_months,
    count_required_work_days,
    count_salary_days_in_range,
    dashboard_salary_period,
    first_full_salary_month,
    first_payment_date,
    normalize_trade_code,
    serialize_leave_request,
)
from ToolApp.models import (
    AttendanceSession,
    EmployeeSalaryProfile,
    EmployeeTeam,
    EmployeeTeamMember,
    Histories,
    LeaveDay,
    LeaveRequest,
    Tools,
    Users,
)


class MobileEmployeeApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.employee = Users.objects.create(
            UserName="Ana Instalator",
            UserSerie="MOB-001",
            UserPin="1111",
            Company="DMX Construction",
            trade="Instalator",
            hire_date=date(2024, 1, 15),
            housing_location="Cazare Centrală",
            total_salary_ron=Decimal("4750.50"),
        )
        self.other_employee = Users.objects.create(
            UserName="Alt Angajat",
            UserSerie="MOB-002",
            UserPin="2222",
            Company="DMX Construction",
            trade="Electrician",
            hire_date=date(2024, 2, 10),
        )
        self.profile = EmployeeSalaryProfile.objects.create(
            employee=self.employee,
            net_salary_eur=Decimal("700.00"),
            net_salary_ron=Decimal("3500.00"),
            salary_advance_ron=Decimal("1100.00"),
            food_money_enabled=True,
            food_money_ron=Decimal("500.00"),
        )

    def post(self, path, payload):
        return self.client.post(path, data=json.dumps(payload), content_type="application/json")

    def credentials(self, **extra):
        return {"pin": "1111", "device_key": "android-device-a", **extra}

    def add_attendance(self, work_date):
        tz = timezone.get_current_timezone()
        in_time = timezone.make_aware(datetime.combine(work_date, time(8, 0)), tz)
        out_time = timezone.make_aware(datetime.combine(work_date, time(16, 0)), tz)
        return AttendanceSession.objects.create(
            user_fk=self.employee,
            work_date=work_date,
            in_time=in_time,
            out_time=out_time,
            duration_seconds=8 * 3600,
            source="manual",
            worksite="Șantier ales la pontaj",
        )

    def add_attendance_for_all_salary_days(self, year, month, limit=None):
        current = date(year, month, 1)
        added = 0
        while current.month == month:
            if current.isoweekday() <= 6 and (limit is None or added < limit):
                self.add_attendance(current)
                added += 1
            current += timedelta(days=1)
        return added

    def assign_employee_to_team(self):
        leader = Users.objects.create(
            UserName="Șef Mobil",
            UserSerie="MOB-LEAD",
            trade="Șef de echipă",
        )
        team = EmployeeTeam.objects.create(name="Echipa Mobilă", leader=leader)
        EmployeeTeamMember.objects.create(team=team, employee=leader)
        EmployeeTeamMember.objects.create(team=team, employee=self.employee)
        return team

    def test_authentication_requires_valid_pin_and_device_key(self):
        bad_pin = self.post(
            "/api/mobile/employee-dashboard/",
            {"pin": "9999", "device_key": "android-device-a"},
        )
        bad_device = self.post(
            "/api/mobile/employee-dashboard/",
            {"pin": "1111", "device_key": ""},
        )
        self.assertEqual(bad_pin.status_code, 404)
        self.assertEqual(bad_pin.json()["error_code"], "INVALID_PIN")
        self.assertEqual(bad_device.status_code, 400)
        self.assertEqual(bad_device.json()["error_code"], "INVALID_DEVICE_KEY")

    def test_employee_id_cannot_select_another_employee(self):
        response = self.post(
            "/api/mobile/employee-dashboard/",
            self.credentials(employee_id=self.other_employee.UserId),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["profile"]["display_name"], self.employee.UserName)

    def test_required_days_count_monday_through_saturday(self):
        self.assertEqual(count_required_work_days(2026, 7), 27)
        self.assertEqual(count_required_work_days(2026, 8), 26)
        self.assertEqual(count_required_work_days(2026, 9), 26)
        self.assertEqual(count_required_work_days(2026, 10), 27)

    def test_attended_day_is_payable(self):
        self.add_attendance(date(2026, 7, 1))
        payroll = calculate_payroll(self.employee, self.profile, 2026, 7)
        self.assertEqual(payroll["worked_days"], 1)
        self.assertEqual(payroll["payable_days"], 1)

    def test_approved_paid_leave_is_payable_and_sunday_is_excluded(self):
        leave = LeaveRequest.objects.create(
            employee=self.employee,
            leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
            start_date=date(2026, 8, 12),
            end_date=date(2026, 8, 18),
            status=LeaveRequest.Status.APPROVED,
        )
        payroll = calculate_payroll(self.employee, self.profile, 2026, 8)
        self.assertEqual(count_salary_days_in_range(leave.start_date, leave.end_date), 6)
        self.assertEqual(payroll["paid_leave_days"], 6)
        self.assertEqual(payroll["payable_days"], 6)
        self.assertEqual(LeaveDay.objects.filter(source_leave_request=leave).count(), 6)

    def test_approved_unpaid_leave_is_not_payable(self):
        LeaveRequest.objects.create(
            employee=self.employee,
            leave_type=LeaveRequest.LeaveType.UNPAID_LEAVE,
            start_date=date(2026, 8, 3),
            end_date=date(2026, 8, 4),
            status=LeaveRequest.Status.APPROVED,
        )
        payroll = calculate_payroll(self.employee, self.profile, 2026, 8)
        self.assertEqual(payroll["unpaid_leave_days"], 2)
        self.assertEqual(payroll["payable_days"], 0)

    def test_day_without_attendance_is_not_payable(self):
        payroll = calculate_payroll(self.employee, self.profile, 2026, 7)
        self.assertEqual(payroll["required_days"], 27)
        self.assertEqual(payroll["worked_days"], 0)
        self.assertEqual(payroll["payable_days"], 0)
        self.assertEqual(payroll["salary_due"], "0.00")
        self.assertEqual(payroll["food_money"], "0.00")
        self.assertEqual(payroll["grand_total"], "0.00")

    def test_attendance_and_paid_leave_same_day_are_not_counted_twice(self):
        day = date(2026, 7, 6)
        self.add_attendance(day)
        LeaveRequest.objects.create(
            employee=self.employee,
            leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
            start_date=day,
            end_date=day,
            status=LeaveRequest.Status.APPROVED,
        )
        payroll = calculate_payroll(self.employee, self.profile, 2026, 7)
        self.assertEqual(payroll["worked_days"], 1)
        self.assertEqual(payroll["paid_leave_days"], 1)
        self.assertEqual(payroll["payable_days"], 1)

    def test_full_salary_and_remainder_after_advance(self):
        self.add_attendance_for_all_salary_days(2026, 7)
        payroll = calculate_payroll(self.employee, self.profile, 2026, 7)
        self.assertEqual(payroll["required_days"], 27)
        self.assertEqual(payroll["payable_days"], 27)
        self.assertEqual(payroll["salary_due"], "3500.00")
        self.assertEqual(payroll["advance"], "1100.00")
        self.assertEqual(payroll["remainder"], "2400.00")
        self.assertEqual(payroll["food_money"], "500.00")
        self.assertEqual(payroll["grand_total"], "4000.00")

    def test_salary_is_reduced_proportionally(self):
        self.add_attendance_for_all_salary_days(2026, 7, limit=24)
        payroll = calculate_payroll(self.employee, self.profile, 2026, 7)
        self.assertEqual(payroll["payable_days"], 24)
        self.assertEqual(payroll["salary_due"], "3111.11")
        self.assertEqual(payroll["advance"], "1100.00")
        self.assertEqual(payroll["remainder"], "2011.11")
        self.assertEqual(payroll["grand_total"], "3611.11")

    def test_advance_never_exceeds_salary_due(self):
        self.add_attendance(date(2026, 7, 1))
        payroll = calculate_payroll(self.employee, self.profile, 2026, 7)
        self.assertEqual(payroll["advance"], payroll["salary_due"])
        self.assertEqual(payroll["remainder"], "0.00")

    def test_unexcused_absence_is_not_payable_and_has_deduction(self):
        LeaveDay.objects.create(
            user_fk=self.employee,
            work_date=date(2026, 7, 1),
            reason=LeaveDay.Reason.UNEXCUSED,
        )
        payroll = calculate_payroll(self.employee, self.profile, 2026, 7)
        self.assertEqual(payroll["unexcused_absence_days"], 1)
        self.assertEqual(payroll["absence_deduction"], "129.63")
        self.assertEqual(payroll["payable_days"], 0)

    def test_hired_june_20_schedules_first_august_payments(self):
        self.employee.hire_date = date(2026, 6, 20)
        self.employee.save(update_fields=("hire_date",))

        with patch("ToolApp.mobile_views.localdate", return_value=date(2026, 7, 15)):
            july_response = self.post("/api/mobile/employee-dashboard/", self.credentials())
        july_payload = july_response.json()
        self.assertEqual(july_payload["payroll"]["salary_year"], 2026)
        self.assertEqual(july_payload["payroll"]["salary_month"], 7)
        self.assertEqual(
            [(item["payment_date"], item["type"], item["amount"]) for item in july_payload["salary_payments"]],
            [
                ("2026-08-05", "salary_advance", "0.00"),
                ("2026-08-20", "salary_remainder", "0.00"),
                ("2026-08-20", "food_money", "0.00"),
            ],
        )
        self.assertEqual(july_payload["first_payment_date"], "2026-08-05")
        self.assertEqual(july_payload["message_code"], "first_salary_after_full_month")

        self.add_attendance_for_all_salary_days(2026, 7)
        july_payroll = calculate_payroll(self.employee, self.profile, 2026, 7)
        august_payments = build_salary_payments(self.profile, july_payroll, 2026, 8)
        self.assertEqual(
            [(item["payment_date"], item["type"]) for item in august_payments],
            [
                ("2026-08-05", "salary_advance"),
                ("2026-08-20", "salary_remainder"),
                ("2026-08-20", "food_money"),
            ],
        )

    def test_first_full_salary_month_rules_use_exact_hire_dates(self):
        self.assertEqual(first_full_salary_month(date(2026, 7, 1)), date(2026, 7, 1))
        self.assertEqual(first_payment_date(date(2026, 7, 1)), date(2026, 8, 5))
        self.assertEqual(first_full_salary_month(date(2026, 6, 20)), date(2026, 7, 1))
        self.assertEqual(first_payment_date(date(2026, 6, 20)), date(2026, 8, 5))
        self.assertEqual(first_full_salary_month(date(2026, 7, 2)), date(2026, 8, 1))
        self.assertEqual(first_payment_date(date(2026, 7, 2)), date(2026, 9, 5))

    def test_hired_july_1_dashboard_on_july_29_uses_july_salary_period(self):
        self.employee.hire_date = date(2026, 7, 1)
        self.employee.save(update_fields=("hire_date",))
        with patch("ToolApp.mobile_views.localdate", return_value=date(2026, 7, 29)):
            response = self.post("/api/mobile/employee-dashboard/", self.credentials())
        payload = response.json()
        self.assertEqual(dashboard_salary_period(date(2026, 7, 29), self.employee.hire_date), (2026, 7))
        self.assertEqual(payload["payroll"]["salary_year"], 2026)
        self.assertEqual(payload["payroll"]["salary_month"], 7)
        self.assertEqual(payload["payroll"]["required_days"], 27)
        self.assertEqual(payload["payroll"]["food_money"], "0.00")
        self.assertEqual(payload["payroll"]["grand_total"], "0.00")
        self.assertEqual(
            [(item["payment_date"], item["type"], item["amount"]) for item in payload["salary_payments"]],
            [
                ("2026-08-05", "salary_advance", "0.00"),
                ("2026-08-20", "salary_remainder", "0.00"),
                ("2026-08-20", "food_money", "0.00"),
            ],
        )
        self.assertEqual(payload["first_payment_date"], "2026-08-05")

    def test_hired_july_2_dashboard_uses_august_as_first_full_month(self):
        self.employee.hire_date = date(2026, 7, 2)
        self.employee.save(update_fields=("hire_date",))
        with patch("ToolApp.mobile_views.localdate", return_value=date(2026, 7, 29)):
            response = self.post("/api/mobile/employee-dashboard/", self.credentials())
        payload = response.json()
        self.assertEqual(payload["payroll"]["salary_year"], 2026)
        self.assertEqual(payload["payroll"]["salary_month"], 8)
        self.assertEqual(payload["first_payment_date"], "2026-09-05")
        self.assertEqual(
            [(item["payment_date"], item["type"], item["amount"]) for item in payload["salary_payments"]],
            [
                ("2026-09-05", "salary_advance", "0.00"),
                ("2026-09-20", "salary_remainder", "0.00"),
                ("2026-09-20", "food_money", "0.00"),
            ],
        )

    def test_salary_period_before_hire_has_all_payment_amounts_zero(self):
        self.employee.hire_date = date(2026, 7, 2)
        self.employee.save(update_fields=("hire_date",))
        payroll = calculate_payroll(self.employee, self.profile, 2026, 6)
        for key in ("salary_due", "advance", "remainder", "food_money", "grand_total"):
            self.assertEqual(payroll[key], "0.00")

    def test_leave_accrual_and_flooring(self):
        self.employee.hire_date = date(2026, 6, 20)
        self.employee.save(update_fields=("hire_date",))
        expectations = (
            (date(2026, 7, 31), 1, Decimal("1.66"), 1),
            (date(2026, 8, 31), 2, Decimal("3.32"), 3),
            (date(2026, 9, 30), 3, Decimal("4.98"), 4),
            (date(2026, 12, 31), 6, Decimal("9.96"), 9),
            (date(2027, 6, 30), 6, Decimal("9.96"), 9),
        )
        for as_of, months, accrued, available in expectations:
            self.assertEqual(completed_full_months(self.employee.hire_date, as_of), months)
            self.assertEqual(accrued_leave_days(self.employee, as_of), accrued)
            self.assertEqual(calculate_available_leave_days(self.employee, as_of), available)

    def test_full_calendar_year_is_capped_at_twenty_leave_days(self):
        self.employee.hire_date = date(2024, 1, 1)
        self.employee.save(update_fields=("hire_date",))

        self.assertEqual(completed_full_months(self.employee.hire_date, date(2026, 12, 31)), 12)
        self.assertEqual(accrued_leave_days(self.employee, date(2026, 12, 31)), Decimal("20.00"))
        self.assertEqual(calculate_available_leave_days(self.employee, date(2026, 12, 31)), 20)

    def test_employee_without_hire_date_is_treated_as_legacy_employee(self):
        self.employee.hire_date = None
        self.employee.save(update_fields=("hire_date",))

        self.assertEqual(completed_full_months(None, date(2026, 8, 31)), 8)
        self.assertEqual(accrued_leave_days(self.employee, date(2026, 8, 31)), Decimal("13.28"))

    def test_first_attendance_is_used_when_hire_date_is_missing(self):
        self.employee.hire_date = None
        self.employee.save(update_fields=("hire_date",))
        AttendanceSession.objects.create(
            user_fk=self.employee,
            work_date=date(2026, 5, 10),
        )

        self.assertEqual(accrued_leave_days(self.employee, date(2026, 8, 31)), Decimal("4.98"))

    def test_prior_and_manually_marked_leave_days_reduce_balance_without_duplicates(self):
        self.employee.hire_date = date(2024, 1, 1)
        self.employee.prior_paid_leave_days = 3
        self.employee.prior_paid_leave_year = 2026
        self.employee.save(update_fields=("hire_date", "prior_paid_leave_days", "prior_paid_leave_year"))
        LeaveDay.objects.create(
            user_fk=self.employee,
            work_date=date(2026, 8, 3),
            reason=LeaveDay.Reason.CO,
        )
        approved = LeaveRequest.objects.create(
            employee=self.employee,
            leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
            start_date=date(2026, 8, 4),
            end_date=date(2026, 8, 5),
            status=LeaveRequest.Status.APPROVED,
        )

        summary = build_leave_summary(self.employee, date(2026, 8, 31))

        self.assertEqual(summary["total_used_days"], 6)
        self.assertEqual(summary["prior_used_days"], 3)
        self.assertEqual(summary["remaining_days"], "7.28")
        self.assertEqual(LeaveDay.objects.filter(source_leave_request=approved).count(), 2)
        next_year = build_leave_summary(self.employee, date(2027, 8, 31))
        self.assertEqual(next_year["prior_used_days"], 0)
        self.assertEqual(next_year["remaining_days"], "13.28")

    def test_manual_remaining_balance_override_tracks_new_leave_days(self):
        self.employee.hire_date = date(2024, 1, 1)
        self.employee.leave_remaining_override_days = Decimal("6.50")
        self.employee.leave_remaining_override_year = 2026
        self.employee.leave_remaining_override_used_days = 0
        self.employee.leave_remaining_override_accrued_days = Decimal("13.28")
        self.employee.save(update_fields=(
            "hire_date",
            "leave_remaining_override_days",
            "leave_remaining_override_year",
            "leave_remaining_override_used_days",
            "leave_remaining_override_accrued_days",
        ))
        self.assertEqual(build_leave_summary(self.employee, date(2026, 8, 31))["remaining_days"], "6.50")

        LeaveDay.objects.create(
            user_fk=self.employee,
            work_date=date(2026, 8, 3),
            reason=LeaveDay.Reason.CO,
        )

        summary = build_leave_summary(self.employee, date(2026, 8, 31))
        self.assertEqual(summary["remaining_days"], "5.50")
        self.assertTrue(summary["remaining_days_overridden"])
        self.assertEqual(build_leave_summary(self.employee, date(2026, 9, 30))["remaining_days"], "7.16")
        self.assertEqual(build_leave_summary(self.employee, date(2027, 8, 31))["remaining_days"], "13.28")

    @patch("ToolApp.mobile_views.localdate", return_value=date(2026, 8, 31))
    def test_leave_balance_api_exposes_accrued_used_and_remaining_days(self, _localdate_mock):
        LeaveRequest.objects.create(
            employee=self.employee,
            leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
            start_date=date(2026, 8, 3),
            end_date=date(2026, 8, 4),
            status=LeaveRequest.Status.APPROVED,
        )

        response = self.post("/api/mobile/leave-balance/", self.credentials())

        self.assertEqual(response.status_code, 200, response.content)
        balance = response.json()["leave_balance"]
        self.assertEqual(balance["annual_entitlement_days"], 20)
        self.assertEqual(balance["monthly_accrual_days"], "1.66")
        self.assertEqual(balance["total_accrued_days"], "13.28")
        self.assertEqual(balance["total_used_days"], 2)
        self.assertEqual(balance["remaining_days"], "11.28")
        self.assertEqual(balance["available_days"], 11)

    def test_paid_leave_cannot_be_approved_over_available_balance(self):
        self.employee.hire_date = date(2026, 6, 20)
        self.employee.save(update_fields=("hire_date",))
        leave = LeaveRequest(
            employee=self.employee,
            leave_type=LeaveRequest.LeaveType.PAID_LEAVE,
            start_date=date(2026, 8, 3),
            end_date=date(2026, 8, 4),
            status=LeaveRequest.Status.APPROVED,
        )
        with patch("django.utils.timezone.localdate", return_value=date(2026, 7, 31)):
            with self.assertRaises(ValidationError):
                leave.save()

    def test_overlapping_leave_requests_are_rejected(self):
        self.assign_employee_to_team()
        first = self.post(
            "/api/mobile/leave-requests/",
            self.credentials(
                leave_type="paid_leave",
                start_date="2026-08-12",
                end_date="2026-08-18",
            ),
        )
        second = self.post(
            "/api/mobile/leave-requests/",
            self.credentials(
                leave_type="unpaid_leave",
                start_date="2026-08-18",
                end_date="2026-08-20",
            ),
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(second.json()["error_code"], "OVERLAPPING_LEAVE_REQUEST")

    def test_leave_request_accepts_reason_field(self):
        team = self.assign_employee_to_team()
        response = self.post(
            "/api/mobile/leave-requests/",
            self.credentials(
                leave_type="paid_leave",
                start_date="2026-08-12",
                end_date="2026-08-18",
                reason="Vacanță cu familia",
            ),
        )
        self.assertEqual(response.status_code, 201)
        payload = response.json()["leave_request"]
        self.assertEqual(payload["leave_days"], 6)
        self.assertEqual(payload["status"], "pending")
        self.assertEqual(payload["status_label"], "În așteptare")
        self.assertEqual(payload["team"], {"id": team.pk, "name": team.name})
        self.assertEqual(payload["reason"], "Vacanță cu familia")
        self.assertNotIn("rejection_reason", payload)

    def test_history_net_quantity_and_fully_returned_tools(self):
        active_tool = Tools.objects.create(ToolSerie="TOOL-A", ToolName="Bormașină")
        returned_tool = Tools.objects.create(ToolSerie="TOOL-B", ToolName="Multimetru")
        first_out = timezone.now() - timedelta(days=10)
        Histories.objects.create(
            user_fk=self.employee,
            tool_fk=active_tool,
            timestamp=first_out,
            direction=Histories.Movement.OUT,
            quantity=5,
        )
        Histories.objects.create(
            user_fk=self.employee,
            tool_fk=active_tool,
            timestamp=timezone.now() - timedelta(days=2),
            direction=Histories.Movement.IN,
            quantity=2,
        )
        Histories.objects.create(
            user_fk=self.employee,
            tool_fk=returned_tool,
            direction=Histories.Movement.OUT,
            quantity=1,
        )
        Histories.objects.create(
            user_fk=self.employee,
            tool_fk=returned_tool,
            direction=Histories.Movement.IN,
            quantity=1,
        )
        equipment, tools = build_inventory(self.employee)
        self.assertEqual(equipment, [])
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["name_code"], "drill")
        self.assertEqual(tools[0]["quantity"], 3)
        self.assertEqual(tools[0]["assigned_date"], first_out.date().isoformat())

    def test_team_leader_not_duplicated_and_current_user_last(self):
        leader = Users.objects.create(UserName="Lider", UserSerie="TEAM-1", trade="Șef de echipă")
        member = Users.objects.create(UserName="Membru", UserSerie="TEAM-2", trade="Dulgher")
        team = EmployeeTeam.objects.create(name="Echipa 1", leader=leader)
        EmployeeTeamMember.objects.create(team=team, employee=leader)
        EmployeeTeamMember.objects.create(team=team, employee=member)
        EmployeeTeamMember.objects.create(team=team, employee=self.employee)
        payload = build_team(self.employee)
        self.assertEqual(payload["leader"]["employee_id"], leader.UserId)
        self.assertEqual(payload["leader"]["trade_code"], "team_leader")
        self.assertNotIn(leader.UserId, [item["employee_id"] for item in payload["members"]])
        self.assertEqual(payload["members"][-1]["employee_id"], self.employee.UserId)
        self.assertTrue(payload["members"][-1]["is_current_user"])

    def test_only_one_active_team_membership_is_allowed(self):
        first_leader = Users.objects.create(UserName="Lider 1", UserSerie="TEAM-3")
        second_leader = Users.objects.create(UserName="Lider 2", UserSerie="TEAM-4")
        first_team = EmployeeTeam.objects.create(name="Echipa 1", leader=first_leader)
        second_team = EmployeeTeam.objects.create(name="Echipa 2", leader=second_leader)
        EmployeeTeamMember.objects.create(team=first_team, employee=self.employee)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                EmployeeTeamMember.objects.create(team=second_team, employee=self.employee)

    def test_trade_codes_are_stable(self):
        self.assertEqual(normalize_trade_code("Instalator"), "installer")
        self.assertEqual(normalize_trade_code("Electrician"), "electrician")
        self.assertEqual(normalize_trade_code("Dulgher"), "carpenter")
        self.assertEqual(normalize_trade_code("Șef de echipă"), "team_leader")
        self.assertEqual(normalize_trade_code("Șef șantier"), "site_manager")
        self.assertEqual(normalize_trade_code("S\u0326ef s\u0326antier"), "site_manager")

    def test_dashboard_has_final_shape_without_permanent_worksite_or_payment_status(self):
        response = self.post("/api/mobile/employee-dashboard/", self.credentials())
        payload = response.json()
        self.assertNotIn("worksite", payload["profile"])
        self.assertNotIn("calendar_configured", payload["payroll"])
        self.assertTrue(all("status" not in item for item in payload["salary_payments"]))
        self.assertEqual(payload["total_salary_ron"], "4750.50")
        self.assertEqual(payload["attendance"]["year"], timezone.localdate().year)
        self.assertEqual(payload["attendance"]["month"], timezone.localdate().month)
        self.assertEqual(
            set(payload),
            {
                "success", "profile", "total_salary_ron", "attendance", "payroll",
                "salary_payments", "leave_summary", "equipment", "tools", "team",
            },
        )

    def test_monthly_attendance_uses_current_month_sessions_and_leave_days(self):
        today = timezone.localdate()
        first_day = date(today.year, today.month, 1)
        self.add_attendance(first_day)
        leave_day = first_day + timedelta(days=1)
        while leave_day.isoweekday() > 6:
            leave_day += timedelta(days=1)
        LeaveDay.objects.create(
            user_fk=self.employee,
            work_date=leave_day,
            reason=LeaveDay.Reason.CO,
        )

        payload = build_monthly_attendance(self.employee, today.year, today.month)

        self.assertEqual(payload["worked_days"], 1)
        self.assertEqual(payload["leave_days"], 1)

    def test_leave_serialization_has_only_simplified_fields(self):
        leave = LeaveRequest.objects.create(
            employee=self.employee,
            leave_type=LeaveRequest.LeaveType.UNPAID_LEAVE,
            start_date=date(2026, 8, 3),
            end_date=date(2026, 8, 4),
        )
        payload = serialize_leave_request(leave)
        self.assertEqual(payload["leave_days"], 2)
        self.assertEqual(payload["reason"], "")
        self.assertNotIn("calendar_days", payload)
