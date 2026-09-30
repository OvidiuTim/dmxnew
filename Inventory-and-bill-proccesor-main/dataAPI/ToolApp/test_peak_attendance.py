import io
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from urllib.request import Request, urlopen
from unittest.mock import patch

from django.core.management import call_command
from django.core.servers.basehttp import WSGIServer
from django.db import DatabaseError, connection, transaction
from django.test import LiveServerTestCase, TestCase, TransactionTestCase, override_settings
from django.test.testcases import LiveServerThread, QuietWSGIRequestHandler
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from ToolApp.attendance_alert_escalation import run_attendance_maintenance
from ToolApp.models import AppUser, AttendanceSession, PresenceEvent, Users
from ToolApp.security import make_app_user_token
from ToolApp.views import _monitor_initial_events, close_open_sessions_for_day_at_1730


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class PeakRequestTests(TestCase):
    def test_http_maintenance_does_no_queries_or_external_calls(self):
        with patch('ToolApp.attendance_alert_escalation.ensure_team_attendance_alerts_due') as alerts:
            with self.assertNumQueries(0):
                self.assertFalse(run_attendance_maintenance())
            alerts.assert_not_called()

    def test_portal_opens_without_running_company_jobs(self):
        employee = Users.objects.create(UserName='Peak user', UserSerie='PEAK', UserPin='1234')
        account = AppUser.objects.create(employee=employee, username='peak', pin_hash='!')
        self.client.cookies['appj'] = make_app_user_token(account)
        with patch('ToolApp.attendance_alert_escalation.ensure_team_attendance_alerts_due') as alerts:
            with patch('ToolApp.attendance_alert_escalation.process_pending_escalations') as emails:
                response = self.client.get('/api/team-portal/dashboard/')
        self.assertEqual(response.status_code, 200)
        alerts.assert_not_called()
        emails.assert_not_called()

    def test_login_never_runs_retention(self):
        with patch('ToolApp.employee_retention.purge_expired_dismissed_employees') as purge:
            with patch('ToolApp.views._expected_password', return_value='test-password'):
                response = self.client.post('/api/auth/login/', json.dumps({'password': 'test-password'}), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        purge.assert_not_called()

    def test_health_checks_backend_and_returns_failure_without_database_details(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'ok': True})
        with patch('ToolApp.health.connection.cursor', side_effect=DatabaseError('private connection data')):
            response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'ok': False})

    def test_monitor_is_finite_and_replays_committed_events_across_requests(self):
        employee = Users.objects.create(UserName='Monitor user', UserSerie='MONITOR')
        now = timezone.now()
        session = AttendanceSession.objects.create(user_fk=employee, work_date=timezone.localdate(), in_time=now - timedelta(hours=2))
        response = self.client.get('/api/pontaj/stream/')
        self.assertFalse(response.streaming)
        body = response.content.decode()
        self.assertIn('retry: 5000', body)
        self.assertIn('event: snapshot', body)
        cursor = next(line[4:] for line in body.splitlines() if line.startswith('id: '))
        session.out_time = now
        session.save(update_fields=['out_time'])
        response = self.client.get('/api/pontaj/stream/', HTTP_LAST_EVENT_ID=cursor)
        self.assertFalse(response.streaming)
        body = response.content.decode()
        self.assertIn('event: exit', body)
        cursor = next(line[4:] for line in body.splitlines() if line.startswith('id: '))
        response = self.client.get('/api/pontaj/stream/', HTTP_LAST_EVENT_ID=cursor)
        self.assertNotIn('event: exit\n', response.content.decode())

    def test_monitor_queries_are_bounded_and_do_not_load_photos(self):
        employee = Users.objects.create(UserName='Volume', UserSerie='VOL', photo='large-profile-photo')
        now = timezone.now()
        AttendanceSession.objects.bulk_create([
            AttendanceSession(user_fk=employee, work_date=timezone.localdate(),
                              in_time=now - timedelta(minutes=index + 1),
                              out_time=now - timedelta(seconds=index),
                              checkin_photo='large-selfie', checkout_photo='large-selfie')
            for index in range(100)
        ])
        with CaptureQueriesContext(connection) as queries:
            events = _monitor_initial_events()
        self.assertEqual(len(events), 24)
        self.assertEqual(len(queries), 2)
        for query in queries:
            self.assertIn('LIMIT 24', query['sql'])
            self.assertNotIn('photo', query['sql'])

    def test_background_command_performs_work_and_honors_no_send_options(self):
        module = 'ToolApp.management.commands.process_attendance_alert_escalations'
        with patch(f'{module}.run_attendance_maintenance') as maintenance:
            with patch(f'{module}.send_late_checkin_report', return_value={'status': 'already_sent'}):
                call_command('process_attendance_alert_escalations', '--maintenance', '--no-email', '--no-push', stdout=io.StringIO())
        self.assertTrue(maintenance.call_args.kwargs['force'])
        self.assertFalse(maintenance.call_args.kwargs['send_email'])
        self.assertFalse(maintenance.call_args.kwargs['send_push'])

    def test_overlapping_background_command_skips_instead_of_queuing(self):
        module = 'ToolApp.management.commands.process_attendance_alert_escalations'
        with patch(f'{module}.fcntl.flock', side_effect=BlockingIOError):
            with patch(f'{module}.run_attendance_maintenance') as maintenance:
                call_command('process_attendance_alert_escalations', '--maintenance', stdout=io.StringIO())
        maintenance.assert_not_called()


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class AutoCloseTransactionTests(TransactionTestCase):
    def test_batch_commits_each_employee_and_is_idempotent(self):
        now = timezone.now()
        day = timezone.localdate()
        employees = [Users.objects.create(UserName=f'Employee {i}', UserSerie=f'BATCH-{i}') for i in range(3)]
        for employee in employees:
            AttendanceSession.objects.create(user_fk=employee, work_date=day, in_time=now - timedelta(hours=2))
        committed = []

        def record_commit(employee, **kwargs):
            # Each employee must commit before the next is processed. This fails
            # when a single atomic block encloses the entire company.
            self.assertEqual(len(committed), employees.index(employee))
            transaction.on_commit(lambda: committed.append(employee.pk))

        with patch('ToolApp.fleet_services.close_open_utilaj_sessions', side_effect=record_commit):
            self.assertEqual(close_open_sessions_for_day_at_1730(day), 3)
        self.assertEqual(committed, [employee.pk for employee in employees])
        self.assertEqual(close_open_sessions_for_day_at_1730(day), 0)
        self.assertEqual(PresenceEvent.objects.filter(kind=PresenceEvent.Kind.EXIT).count(), 3)


class SingleWorkerServer(LiveServerThread):
    def _create_server(self, connections_override=None):
        return WSGIServer((self.host, self.port), QuietWSGIRequestHandler, allow_reuse_address=False)


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'],
                   SECURE_SSL_REDIRECT=False)
class SingleWorkerPeakTests(LiveServerTestCase):
    """Real concurrent HTTP clients sharing just one synchronous WSGI worker."""
    server_thread_class = SingleWorkerServer

    def test_monitors_checkout_and_login_all_finish(self):
        now = timezone.now()
        jobs = [('/api/pontaj/stream/', None)] * 6
        employee_ids = []
        for i in range(4):
            pin = str(5400 + i)
            employee = Users.objects.create(UserName=f'Peak {i}', UserSerie=f'HTTP-{i}', UserPin=pin)
            employee_ids.append(employee.pk)
            AttendanceSession.objects.create(user_fk=employee, work_date=timezone.localdate(), in_time=now - timedelta(hours=1))
            jobs.append(('/api/nfc/scan/', {'uid': f'PEAK-CARD-{i}', 'content': pin, 'type': 'pin', 'worksite': 'diverse'}))
        jobs += [('/api/auth/login/', {'password': 'peak-test-password'})] * 2

        def request(job):
            path, data = job
            req = Request(self.live_server_url + path,
                          data=json.dumps(data).encode() if data is not None else None,
                          headers={'Content-Type': 'application/json'})
            with urlopen(req, timeout=5) as response:
                return path, response.status, response.read()

        with patch('ToolApp.views._expected_password', return_value='peak-test-password'):
            with ThreadPoolExecutor(max_workers=6) as clients:
                results = list(clients.map(request, jobs))
        self.assertEqual(len(results), 12)
        for path, status, body in results:
            self.assertEqual(status, 200, (path, body))
            if path == '/api/nfc/scan/':
                self.assertEqual(json.loads(body)['state'], 'EXIT')
        self.assertEqual(AttendanceSession.objects.filter(user_fk_id__in=employee_ids, out_time__isnull=False).count(), 4)
        self.assertFalse(AttendanceSession.objects.filter(user_fk_id__in=employee_ids, out_time__isnull=True).exists())
