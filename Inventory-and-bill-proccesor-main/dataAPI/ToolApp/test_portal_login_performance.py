import json
from unittest.mock import patch

from django.core.cache import cache
from django.db import connection
from django.test import Client, RequestFactory, TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from ToolApp.models import (
    AppUser, AttendanceAbsenceMark, EmployeeTeam, EmployeeTeamMember, LeaveDay, Users,
)
from ToolApp.security import make_admin_token, make_app_user_token
from ToolApp.team_portal_views import portal_personnel, portal_supervised_teams


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class PinOnlyLoginTests(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.employee = Users.objects.create(UserName='Angajat PIN', UserSerie='PIN-ONLY', UserPin='0123')
        self.account = AppUser.objects.create(employee=self.employee, username='pin-only', pin_hash='!')

    def login(self, pin='0123', **extra):
        return self.client.post('/api/app-auth/login/', json.dumps({'pin': pin, **extra}), content_type='application/json')

    def test_employee_pin_opens_portal_without_admin_access(self):
        self.client.cookies['ptj'] = make_admin_token()
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['role'], 'app_user')
        self.assertEqual(response.json()['default_module_route'], '/team-dashboard')
        self.assertEqual(response.json()['app_user']['employee']['id'], self.employee.pk)
        self.assertEqual(response.cookies['ptj']['max-age'], 0)
        with patch('ToolApp.team_portal_views.run_attendance_maintenance'):
            self.assertEqual(self.client.get('/api/team-portal/dashboard/').status_code, 200)
        self.assertEqual(self.client.get('/api/team-portal/personnel/').status_code, 403)
        self.assertEqual(self.client.post('/api/auth/verify/').status_code, 401)

    def test_changed_pin_invalidates_old_pin(self):
        Users.objects.filter(pk=self.employee.pk).update(UserPin='0456')
        self.assertEqual(self.login().status_code, 401)
        self.assertEqual(self.login('0456').status_code, 200)

    def test_duplicate_active_employee_pins_are_rejected(self):
        Users.objects.create(UserName='Duplicat', UserSerie='PIN-DUP', UserPin='0123')
        response = self.login()
        self.assertEqual(response.status_code, 401)
        self.assertNotIn('appj', response.cookies)

    def test_inactive_accounts_are_not_reactivated_by_login(self):
        AppUser.objects.filter(pk=self.account.pk).update(is_active=False)
        self.assertEqual(self.login().status_code, 401)
        self.account.refresh_from_db()
        self.assertFalse(self.account.is_active)

    def test_dismissed_inactive_and_collaborator_employees_cannot_login(self):
        for fields in ({'employment_status': 'dismissed'}, {'active': False}, {'person_type': 'collaborator'}):
            with self.subTest(fields=fields):
                Users.objects.filter(pk=self.employee.pk).update(active=True, employment_status='active', person_type='employee')
                Users.objects.filter(pk=self.employee.pk).update(**fields)
                self.assertEqual(self.login().status_code, 401)

    def test_missing_account_is_created_for_active_employee(self):
        self.account.delete()
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(AppUser.objects.filter(employee=self.employee).count(), 1)

    def test_pin_attempts_are_limited(self):
        for _ in range(5):
            self.assertEqual(self.login('wrong').status_code, 401)
        response = self.login()
        self.assertEqual(response.status_code, 429)
        self.assertGreater(int(response['Retry-After']), 0)

    def test_blank_pin_is_rejected(self):
        self.assertEqual(self.login(' ').status_code, 400)

    def test_existing_username_clients_still_work(self):
        self.assertEqual(self.login(username=self.account.username).status_code, 200)

    @override_settings(PONTAJ_PASSWORD='test-admin-password')
    def test_general_password_keeps_admin_session_and_clears_employee_cookie(self):
        self.client.cookies['appj'] = make_app_user_token(self.account)
        with patch('ToolApp.views._expected_password', return_value='test-admin-password'):
            response = self.client.post('/api/auth/login/', json.dumps({'password': 'test-admin-password'}), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['role'], 'admin')
        self.assertEqual(response.cookies['appj']['max-age'], 0)
        self.assertEqual(self.client.post('/api/auth/verify/').status_code, 200)


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class PortalQueryScalingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.supervisor = Users.objects.create(UserName='Supervisor', UserSerie='PERF-S')
        self.actor = AppUser.objects.create(employee=self.supervisor, username='perf-supervisor', pin_hash='!')
        self.leader = Users.objects.create(UserName='Leader', UserSerie='PERF-L')
        self.team = EmployeeTeam.objects.create(name='Perf team', leader=self.leader, supervisor=self.supervisor)
        self.factory = RequestFactory()

    def add_absent_members(self, start, count):
        for index in range(start, start + count):
            employee = Users.objects.create(UserName=f'Member {index}', UserSerie=f'PERF-{index}')
            EmployeeTeamMember.objects.create(team=self.team, employee=employee)
            LeaveDay.objects.create(user_fk=employee, work_date=timezone.localdate(), reason=LeaveDay.Reason.UNEXCUSED)
            AttendanceAbsenceMark.objects.create(
                employee=employee, team=self.team, work_date=timezone.localdate(),
                marked_by=self.actor, source=AttendanceAbsenceMark.Source.SUPERVISOR,
            )

    def measure(self, view):
        request = self.factory.get('/')
        request.app_user = self.actor
        with CaptureQueriesContext(connection) as queries:
            response = view(request)
        self.assertEqual(response.status_code, 200)
        return len(queries), json.loads(response.content)

    def test_personnel_and_supervised_queries_do_not_grow_per_absent_employee(self):
        self.add_absent_members(0, 1)
        baseline = {view: self.measure(view)[0] for view in (portal_personnel, portal_supervised_teams)}
        self.add_absent_members(1, 30)
        for view in baseline:
            with self.subTest(view=view.__name__):
                query_count, data = self.measure(view)
                self.assertEqual(query_count, baseline[view])
                rows = data['employees'] if view == portal_personnel else data['teams'][0]['members']
                marked = [row for row in rows if row['status'] == 'marked_absent']
                self.assertEqual(len(marked), 31)
                self.assertTrue(all(row['marked_by'] == 'Supervisor' for row in marked))
