import json
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db import connection
from django.test import Client, TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from ToolApp.models import (AppModuleAccess, AppPagePermission, AppUser, AttendanceSession, ConstructionSite,
                            DailyPay, SiteAttendancePoint, SiteAuditLog, SiteExpense, Users)
from ToolApp.security import make_admin_token, make_app_user_token
from ToolApp.site_costs import cost_report
from ToolApp.worksites import ATTENDANCE_WORKSITES


class ConstructionSiteTests(TestCase):
    def setUp(self):
        self.admin = Client()
        self.admin.cookies['ptj'] = make_admin_token()
        self.employee = Users.objects.create(UserName='Ana', UserSerie='SITE-001', hourly_rate=Decimal('30'))
        self.day = date(2026, 8, 12)
        self.site = ConstructionSite.objects.create(code='A', name='Lake A', budget=Decimal('500'))
        SiteAttendancePoint.objects.create(site=self.site, name='The Lake Home Bloc A')
        self.base = '/api/construction-sites/'

    def post(self, path, body, client=None):
        return (client or self.admin).post(path, json.dumps(body), content_type='application/json')

    def session(self, point='The Lake Home Bloc A', seconds=3600, day=None, employee=None, closed=True):
        day = day or self.day
        start = timezone.make_aware(datetime.combine(day, datetime.min.time()))
        return AttendanceSession.objects.create(user_fk=employee or self.employee, work_date=day, worksite=point,
            in_time=start, out_time=start + timedelta(seconds=seconds) if closed else None, duration_seconds=seconds)

    def snapshot(self, rate='20', seconds=3600):
        return DailyPay.objects.create(user_fk=self.employee, work_date=self.day, hourly_rate_snapshot=Decimal(rate), total_seconds=seconds, day_pay=Decimal('999'))

    def expense_body(self, **kwargs):
        return {'date': '2026-08-12', 'category': 'materials', 'description': 'Beton', 'amount': '120.50',
                'request_id': '01900000-0000-4000-8000-000000000001', **kwargs}

    def test_snapshot_rate_aliases_open_sessions_and_unallocated(self):
        self.session('Bloc A', 3600)
        self.session('The Lake Home Bloc A', 7200)
        self.session('Punct necunoscut', 3600)
        self.session(None, 1800)
        self.session(seconds=9999, closed=False)
        self.snapshot(seconds=16200)
        current, lifetime, total = cost_report(self.day, self.day)
        costs = current[self.site.pk]
        self.assertEqual(costs['labor_cost'], '60.00')
        self.assertEqual(costs['hours'], '3.00')
        self.assertEqual(costs['open_sessions'], 1)
        self.assertEqual(costs['estimated_seconds'], 0)
        self.assertEqual(current[0]['labor_cost'], '30.00')
        self.assertEqual(total['labor_cost'], '90.00')
        self.assertEqual(total['employee_count'], 1)
        self.assertEqual(len(costs['points']), 1)
        self.employee.hourly_rate = 90
        self.employee.save(update_fields=['hourly_rate'])
        self.assertEqual(cost_report(self.day, self.day)[0][self.site.pk]['labor_cost'], '60.00')

    def test_missing_and_zero_rates_are_visible(self):
        self.session(seconds=3600)
        current, _, _ = cost_report()
        self.assertEqual(current[self.site.pk]['labor_cost'], '30.00')
        self.assertEqual(current[self.site.pk]['estimated_seconds'], 3600)
        self.snapshot(rate='0')
        current, _, _ = cost_report()
        self.assertEqual(current[self.site.pk]['labor_cost'], '0.00')
        self.assertEqual(current[self.site.pk]['missing_rate_seconds'], 3600)
        self.assertEqual(current[self.site.pk]['estimated_seconds'], 0)

    def test_rounding_preserves_daily_total_across_points(self):
        second = ConstructionSite.objects.create(code='B', name='Lake B')
        SiteAttendancePoint.objects.create(site=second, name='The Lake Home Bloc B2')
        self.session(seconds=1)
        self.session('The Lake Home Bloc B2', seconds=1)
        self.session('diverse', seconds=1)
        self.snapshot(rate='20', seconds=3)
        current, _, total = cost_report()
        self.assertEqual(total['labor_cost'], '0.02')
        self.assertEqual(sum(Decimal(row['labor_cost']) for row in current.values()), Decimal('0.02'))

    def test_budget_uses_lifetime_and_expense_date_filter(self):
        self.session(seconds=3600)
        self.session(seconds=7200, day=date(2026, 7, 1))
        response = self.post(f'{self.base}{self.site.pk}/expenses/', self.expense_body())
        self.assertEqual(response.status_code, 201, response.content)
        response = self.admin.get(self.base, {'start': '2026-08-01', 'end': '2026-08-31'})
        self.assertEqual(response.status_code, 200, response.content)
        site = response.json()['sites'][0]
        self.assertEqual(site['costs']['total_cost'], '150.50')
        self.assertEqual(site['lifetime_cost'], '210.50')
        self.assertEqual(site['budget_remaining'], '289.50')
        self.assertEqual(response.json()['points'][0]['history']['hours'], '3.00')

    def test_create_from_existing_points_links_entire_history_without_copying(self):
        session = self.session('C8', 7200)
        response = self.post(self.base, {'code': ' c8 ', 'name': 'Spital nou', 'points': ['C8', 'Psihiatrie C8'], 'latitude': 45.8, 'longitude': 24.1})
        self.assertEqual(response.status_code, 201, response.content)
        site = response.json()['site']
        self.assertEqual(site['code'], 'C8')
        self.assertEqual(site['points'], ['Psihiatrie C8'])
        self.assertEqual(AttendanceSession.objects.count(), 1)
        session.refresh_from_db()
        self.assertEqual(session.worksite, 'C8')
        self.assertEqual(cost_report()[0][site['id']]['labor_cost'], '60.00')
        self.assertEqual(SiteAuditLog.objects.get(site_id=site['id']).action, 'created')

    def test_point_conflict_is_atomic(self):
        count = ConstructionSite.objects.count()
        response = self.post(self.base, {'code': 'DUP', 'name': 'Duplicat', 'points': ['Bloc A']})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(ConstructionSite.objects.count(), count)

    def test_version_conflict_and_reassignment_audit(self):
        url = f'{self.base}{self.site.pk}/'
        response = self.admin.patch(url, json.dumps({'name': 'Nou', 'version': 99}), content_type='application/json')
        self.assertEqual(response.status_code, 409)
        response = self.admin.patch(url, json.dumps({'name': 'Nou', 'points': ['C8'], 'version': 1}), content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['site']['version'], 2)
        event = SiteAuditLog.objects.get(site=self.site)
        self.assertEqual(event.before['points'], ['The Lake Home Bloc A'])
        self.assertEqual(event.after['points'], ['Psihiatrie C8'])

    def test_import_is_idempotent_and_preserves_existing_association(self):
        first = self.post(self.base + 'import/', {})
        second = self.post(self.base + 'import/', {})
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(first.json()['created_count'], len(ATTENDANCE_WORKSITES) - 1)
        self.assertEqual(second.json()['created_count'], 0)
        self.assertEqual(ConstructionSite.objects.count(), len(ATTENDANCE_WORKSITES))
        self.assertEqual(SiteAttendancePoint.objects.get(name='The Lake Home Bloc A').site_id, self.site.pk)
        river = ConstructionSite.objects.get(name='The River chalet')
        self.assertAlmostEqual(river.latitude, 45.76837384893173)

    def test_expense_retry_cancel_and_audit(self):
        url = f'{self.base}{self.site.pk}/expenses/'
        first = self.post(url, self.expense_body())
        second = self.post(url, self.expense_body())
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(second.status_code, 200, second.content)
        self.assertEqual(SiteExpense.objects.count(), 1)
        conflict = self.post(url, self.expense_body(amount='999'))
        self.assertEqual(conflict.status_code, 409)
        expense_id = first.json()['expense']['id']
        cancel_url = f'{url}{expense_id}/cancel/'
        self.assertEqual(self.post(cancel_url, {'reason': ''}).status_code, 400)
        self.assertEqual(self.post(cancel_url, {'reason': 'Factură greșită'}).status_code, 200)
        self.assertEqual(self.post(cancel_url, {'reason': 'Factură greșită'}).status_code, 200)
        self.assertEqual(cost_report()[2]['expense_cost'], '0.00')
        self.assertEqual(SiteAuditLog.objects.filter(action='expense_cancelled').count(), 1)
        self.assertEqual(self.admin.get(url).json()['count'], 1)

    def test_validation_and_cross_site_cancellation(self):
        for payload in [{'code': 'X', 'name': 'X', 'latitude': 91, 'longitude': 24},
                        {'code': 'X', 'name': 'X', 'latitude': 45},
                        {'code': 'X', 'name': 'X', 'latitude': 'NaN', 'longitude': 'NaN'},
                        {'code': 'X', 'name': 'X', 'budget': '-1'},
                        {'code': 'X', 'name': 'X', 'points': ['Unknown']},
                        {'code': 'X', 'name': 'X', 'start_date': '2026-09-01', 'end_date': '2026-08-01'}]:
            self.assertEqual(self.post(self.base, payload).status_code, 400, payload)
        for amount in ['0', '-1', 'NaN', 'Infinity', '0.001']:
            self.assertEqual(self.post(f'{self.base}{self.site.pk}/expenses/', self.expense_body(amount=amount)).status_code, 400)
        self.assertEqual(self.admin.get(self.base, {'start': '2026-09-08', 'end': '2026-08-01'}).status_code, 400)
        self.assertEqual(self.admin.get(self.base, {'start': 'bad'}).status_code, 400)
        self.assertEqual(self.post(self.base, []).status_code, 400)
        expense = self.post(f'{self.base}{self.site.pk}/expenses/', self.expense_body()).json()['expense']
        second = ConstructionSite.objects.create(code='B', name='B')
        self.assertEqual(self.post(f'{self.base}{second.pk}/expenses/{expense["id"]}/cancel/', {'reason': 'X'}).status_code, 404)

    def test_archiving_preserves_costs_and_blocks_new_expenses(self):
        self.session()
        self.site.status = 'archived'
        self.site.save()
        self.assertEqual(self.post(f'{self.base}{self.site.pk}/expenses/', self.expense_body()).status_code, 400)
        self.assertEqual(cost_report()[0][self.site.pk]['labor_cost'], '30.00')
        self.assertEqual(self.admin.delete(f'{self.base}{self.site.pk}/').status_code, 405)

    def test_read_and_write_permissions_are_separate(self):
        self.assertIn(Client().get(self.base).status_code, (401, 403))
        user, _ = AppUser.objects.get_or_create(employee=self.employee, defaults={'username': 'site-test'})
        client = Client()
        client.cookies['appj'] = make_app_user_token(user)
        AppModuleAccess.objects.create(app_user=user, module_code='attendance')
        self.assertEqual(client.get(self.base).status_code, 403)
        AppModuleAccess.objects.create(app_user=user, module_code='construction_sites')
        self.assertEqual(client.get(self.base).status_code, 200)
        self.assertEqual(client.get(self.base).json()['can_manage'], False)
        self.assertEqual(self.post(self.base, {'code': 'X', 'name': 'X'}, client).status_code, 403)
        AppPagePermission.objects.create(app_user=user, route='/santiere', can_access=True)
        self.assertEqual(self.post(self.base, {'code': 'X', 'name': 'X'}, client).status_code, 201)
        self.assertEqual(client.get(self.base).json()['can_manage'], True)

    def test_report_query_count_does_not_grow_with_employees_or_sites(self):
        self.session()
        with CaptureQueriesContext(connection) as first:
            self.admin.get(self.base)
        for index in range(20):
            employee = Users.objects.create(UserName=f'Worker {index}', UserSerie=f'W{index}', hourly_rate=20)
            self.session(employee=employee)
            ConstructionSite.objects.create(code=f'Z{index}', name=f'Site {index}')
        with CaptureQueriesContext(connection) as second:
            result = self.admin.get(self.base)
        self.assertEqual(result.status_code, 200, result.content)
        self.assertEqual(len(second), len(first))
        self.assertLessEqual(len(second), 8)

    def test_expense_csv_exports_all_filtered_pages_and_escapes_formulas(self):
        SiteExpense.objects.bulk_create([
            SiteExpense(site=self.site, date=self.day, category='materials', description='=HYPERLINK("unsafe")', amount=1, created_by='Test')
            for _ in range(51)
        ])
        SiteExpense.objects.create(site=self.site, date=date(2026, 7, 1), category='materials', description='Outside range', amount=99, created_by='Test')
        url = f'{self.base}{self.site.pk}/expenses/'
        listing = self.admin.get(url, {'start': '2026-08-01', 'end': '2026-08-31'})
        self.assertEqual(listing.json()['count'], 51)
        self.assertEqual(len(listing.json()['expenses']), 50)
        export = self.admin.get(url, {'format': 'csv', 'start': '2026-08-01', 'end': '2026-08-31'})
        self.assertEqual(export.status_code, 200)
        content = export.content.decode('utf-8-sig')
        self.assertEqual(len(content.splitlines()), 52)
        self.assertIn("'=HYPERLINK", content)
        self.assertNotIn('Outside range', content)

    def test_import_catalog_marks_only_available_primary_points(self):
        self.post(self.base + 'import/', {})
        result = self.admin.get(self.base).json()
        self.assertEqual(sum(point['is_primary'] and not point['site_id'] for point in result['points']), 0)
        self.assertEqual(sum(not point['site_id'] for point in result['points']), 2)
