import json
from datetime import datetime, timedelta, timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import Client, TestCase
from django.utils import timezone

from ToolApp.models import AppUser, AttendanceAbsenceMark, AttendanceSession, DailyPay, LeaveDay, PresenceEvent, Users
from ToolApp.security import make_admin_token, make_app_user_token
from ToolApp.worksites import ATTENDANCE_WORKSITES


class TesaPresenceTests(TestCase):
    url = '/api/team-portal/tesa-presence/'

    def setUp(self):
        self.employee = Users.objects.create(UserName='Personal TESA', UserSerie='TESA-1',
                                             UserPin='7011', is_tesa=True, hourly_rate=25)
        self.other = Users.objects.create(UserName='Alt angajat', UserSerie='TESA-2', UserPin='7012')
        self.account = AppUser.objects.create(employee=self.employee, username='tesa-test')
        self.other_account = AppUser.objects.create(employee=self.other, username='non-tesa-test')
        self.client.cookies['appj'] = make_app_user_token(self.account)
        self.now = datetime(2026, 9, 9, 7, 15, tzinfo=dt_timezone.utc)
        self.site = ATTENDANCE_WORKSITES[0]

    def payload(self, **extra):
        return {'worksite': self.site['name'], 'gps': {
            'lat': self.site['latitude'], 'lng': self.site['longitude'],
            'accuracy': 12, 'captured_at': self.now.isoformat(),
        }, **extra}

    def post(self, data=None):
        with patch('ToolApp.tesa_views.timezone.now', return_value=self.now):
            return self.client.post(self.url, json.dumps(self.payload() if data is None else data), content_type='application/json')

    def test_only_active_tesa_can_read_and_confirm(self):
        for attr, value in [('is_tesa', False), ('active', False), ('employment_status', 'dismissed'), ('person_type', 'collaborator')]:
            with self.subTest(attr=attr):
                old = getattr(self.employee, attr)
                Users.objects.filter(pk=self.employee.pk).update(**{attr: value})
                self.assertIn(self.client.get(self.url).status_code, (401, 403))
                self.assertIn(self.post().status_code, (401, 403))
                Users.objects.filter(pk=self.employee.pk).update(**{attr: old})
        anonymous = Client()
        self.assertIn(anonymous.get(self.url).status_code, (401, 403))
        admin = Client()
        admin.cookies['ptj'] = make_admin_token()
        self.assertEqual(admin.get(self.url).status_code, 403)
        self.assertFalse(AttendanceSession.objects.exists())

    def test_admin_checkbox_roundtrip_and_portal_cannot_change_it(self):
        admin = Client()
        admin.cookies['ptj'] = make_admin_token()
        for value in (False, True):
            response = admin.put('/api/user/', json.dumps({'UserId': self.employee.pk, 'UserName': self.employee.UserName, 'is_tesa': value}), content_type='application/json')
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(admin.get(f'/api/user/{self.employee.pk}').json()['is_tesa'], value)
        denied = self.client.put('/api/user/', json.dumps({'UserId': self.other.pk, 'is_tesa': True}), content_type='application/json')
        self.assertIn(denied.status_code, (401, 403))
        self.other.refresh_from_db()
        self.assertFalse(self.other.is_tesa)

    def test_flag_is_in_dashboard_and_fresh_auth_session(self):
        self.assertTrue(self.client.get('/api/team-portal/dashboard/').json()['employee']['is_tesa'])
        response = self.client.post('/api/app-auth/verify/', '{}', content_type='application/json')
        self.assertTrue(response.json()['app_user']['employee']['is_tesa'])
        Users.objects.filter(pk=self.employee.pk).update(is_tesa=False)
        response = self.client.post('/api/app-auth/verify/', '{}', content_type='application/json')
        self.assertFalse(response.json()['app_user']['employee']['is_tesa'])

    def test_creates_exactly_eight_hours_without_photo_for_authenticated_employee(self):
        response = self.post(self.payload(employee_id=self.other.pk, date='2020-01-01', hours=100,
                                           in_time='01:00', out_time='23:00', is_tesa=True))
        self.assertEqual(response.status_code, 201, response.content)
        session = AttendanceSession.objects.get()
        self.assertEqual(session.user_fk_id, self.employee.pk)
        self.assertEqual(str(session.work_date), '2026-09-09')
        self.assertEqual(timezone.localtime(session.in_time).strftime('%H:%M'), '08:00')
        self.assertEqual(timezone.localtime(session.out_time).strftime('%H:%M'), '16:00')
        self.assertEqual(session.duration_seconds, 28800)
        self.assertEqual(session.out_time - session.in_time, timedelta(hours=8))
        self.assertEqual(session.source, 'tesa')
        self.assertEqual(session.worksite, self.site['name'])
        self.assertEqual(session.checkin_photo, '')
        self.assertEqual(session.checkout_photo, '')
        self.assertEqual(session.in_gps_latitude, self.site['latitude'])
        self.assertEqual(session.tesa_confirmed_at, self.now)
        self.assertIsNone(session.out_gps_latitude)
        pay = DailyPay.objects.get()
        self.assertEqual(pay.total_seconds, 28800)
        self.assertEqual(pay.day_pay, Decimal('200.00'))
        self.assertEqual(PresenceEvent.objects.count(), 2)

    def test_repeated_confirmation_and_reload_do_not_duplicate_or_move_hours(self):
        self.assertEqual(self.post().status_code, 201)
        retry = self.post()
        self.assertEqual(retry.status_code, 200)
        self.assertTrue(retry.json()['already_confirmed'])
        with patch('ToolApp.tesa_views.timezone.now', return_value=self.now):
            status = self.client.get(self.url).json()
        self.assertFalse(status['can_confirm'])
        self.assertEqual(status['session']['hours'], 8)
        self.assertEqual(self.post(self.payload(worksite=ATTENDANCE_WORKSITES[1]['name'])).status_code, 409)
        self.assertEqual(AttendanceSession.objects.count(), 1)
        self.assertEqual(DailyPay.objects.count(), 1)
        self.assertEqual(PresenceEvent.objects.count(), 2)

    def test_gps_missing_invalid_stale_or_future_is_rejected(self):
        invalid = [None, {}, {'lat': float('nan')}, {'lat': 91}, {'lng': float('inf')},
                   {'accuracy': -1}, {'lat': True},
                   {'captured_at': (self.now - timedelta(minutes=11)).isoformat()},
                   {'captured_at': (self.now + timedelta(minutes=2)).isoformat()},
                   {'captured_at': '2026-09-09T07:15:00'}]
        for values in invalid:
            payload = self.payload()
            payload['gps'] = values if values in (None, {}) else {**payload['gps'], **values}
            with self.subTest(values=values):
                self.assertEqual(self.post(payload).status_code, 400)
        for payload in ([], {'worksite': 'Nu există'}, self.payload(worksite='')):
            self.assertEqual(self.post(payload).status_code, 400)
        self.assertFalse(AttendanceSession.objects.exists())

    def test_confirmation_is_accepted_outside_the_perimeter_with_the_distance_recorded(self):
        # Spre deosebire de pontajul obisnuit, TESA se poate ponta si din afara
        # santierului; distanta pana la perimetru se salveaza si se raporteaza.
        far = self.payload()
        far['gps'] = {**far['gps'], 'lat': self.site['latitude'] + 0.05, 'lng': self.site['longitude'] + 0.05}
        response = self.post(far)
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertFalse(body['session']['inside_perimeter'])
        self.assertGreater(body['session']['distance_m'], self.site['radius_meters'])
        session = AttendanceSession.objects.get()
        self.assertEqual(session.duration_seconds, 8 * 3600)
        self.assertAlmostEqual(session.in_gps_latitude, self.site['latitude'] + 0.05, places=6)
        with patch('ToolApp.tesa_views.timezone.now', return_value=self.now):
            state = self.client.get(self.url).json()
        self.assertFalse(state['session']['inside_perimeter'])
        self.assertEqual(state['session']['distance_m'], body['session']['distance_m'])

    def test_existing_session_or_leave_prevents_extra_eight_hours(self):
        session = AttendanceSession.objects.create(user_fk=self.employee, work_date=self.now.date(),
                                                    in_time=self.now - timedelta(hours=1), out_time=self.now, duration_seconds=3600)
        self.assertEqual(self.post().status_code, 409)
        session.refresh_from_db()
        self.assertEqual(session.duration_seconds, 3600)
        session.delete()
        LeaveDay.objects.create(user_fk=self.employee, work_date=self.now.date(), reason=LeaveDay.Reason.UNPAID, hours=8)
        self.assertEqual(self.post().status_code, 409)
        self.assertFalse(AttendanceSession.objects.exists())

    def test_previous_open_session_prevents_confirmation(self):
        AttendanceSession.objects.create(user_fk=self.employee, work_date=self.now.date() - timedelta(days=1),
                                          in_time=self.now - timedelta(days=1))
        self.assertEqual(self.post().status_code, 409)
        self.assertEqual(AttendanceSession.objects.count(), 1)

    def test_late_confirmation_resolves_automatic_absence_and_preserves_audit_mark(self):
        mark = AttendanceAbsenceMark.objects.create(employee=self.employee, work_date=self.now.date(),
            source=AttendanceAbsenceMark.Source.AUTOMATIC_LEVEL_2)
        AttendanceAbsenceMark.objects.filter(pk=mark.pk).update(marked_at=self.now - timedelta(hours=1))
        LeaveDay.objects.create(user_fk=self.employee, work_date=self.now.date(), reason=LeaveDay.Reason.UNEXCUSED,
            note='Marcat automat absent la escaladarea Nivel 2')
        self.assertEqual(self.post().status_code, 201)
        self.assertFalse(LeaveDay.objects.filter(user_fk=self.employee).exists())
        self.assertTrue(AttendanceAbsenceMark.objects.filter(pk=mark.pk).exists())
        from ToolApp.team_portal_views import _absent_today_rows
        with patch('ToolApp.team_portal_views.timezone.now', return_value=self.now):
            rows = _absent_today_rows(self.now.date())
        own_row = next(row for row in rows if row['id'] == self.employee.pk)
        self.assertTrue(own_row['checked_in_after_mark'])

    def test_manual_absence_cannot_be_overwritten(self):
        AttendanceAbsenceMark.objects.create(employee=self.employee, work_date=self.now.date(),
            source=AttendanceAbsenceMark.Source.TEAM_LEADER, marked_by=self.other_account)
        LeaveDay.objects.create(user_fk=self.employee, work_date=self.now.date(), reason=LeaveDay.Reason.UNEXCUSED)
        self.assertEqual(self.post().status_code, 409)
        self.assertTrue(LeaveDay.objects.exists())
        self.assertFalse(AttendanceSession.objects.exists())

    def test_date_and_hours_use_bucharest_in_winter_and_after_local_midnight(self):
        for now, day in [(datetime(2026, 1, 10, 23, 30, tzinfo=dt_timezone.utc), '2026-01-11'),
                         (datetime(2026, 9, 10, 21, 30, tzinfo=dt_timezone.utc), '2026-09-11')]:
            with self.subTest(day=day):
                self.now = now
                response = self.post()
                self.assertEqual(response.status_code, 201, response.content)
                self.assertEqual(response.json()['session']['work_date'], day)
                self.assertEqual(response.json()['session']['in_time'][11:16], '08:00')
                self.assertEqual(response.json()['session']['out_time'][11:16], '16:00')

    def test_database_rejects_two_tesa_confirmations_for_the_same_day(self):
        self.assertEqual(self.post().status_code, 201)
        with self.assertRaises(IntegrityError), transaction.atomic():
            AttendanceSession.objects.create(user_fk=self.employee, work_date=self.now.date(), source='tesa')

    def test_pay_failure_rolls_back_session_and_presence_events(self):
        with patch('ToolApp.tesa_views.recompute_daily_pay', side_effect=RuntimeError('test')):
            with self.assertRaises(RuntimeError):
                self.post()
        self.assertFalse(AttendanceSession.objects.exists())
        self.assertFalse(PresenceEvent.objects.exists())

    def test_regular_scan_cannot_add_hours_after_tesa_confirmation(self):
        self.assertEqual(self.post().status_code, 201)
        with patch('ToolApp.views._find_user_by_pin', return_value=self.employee):
            result = self.client.post('/api/nfc/scan/', json.dumps({
                'uid': 'TESA-TEST-TAG', 'content': '7011', 'tag_type': 'nfc',
                'timestamp': self.now.isoformat(), 'worksite': self.site['name'],
            }), content_type='application/json')
        self.assertEqual(result.status_code, 409, result.content)
        self.assertEqual(result.json()['error_code'], 'TESA_ALREADY_CONFIRMED')
        self.assertEqual(AttendanceSession.objects.count(), 1)
