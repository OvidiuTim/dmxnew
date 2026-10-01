#!/usr/bin/env python3
"""Exercise an isolated backend; never accepts a target URL or employee PINs.

PostgreSQL mode requires an EMPTY, disposable pontaj_loadtest_<12 hex> database.
SQLite smoke mode checks the harness only, with one request thread.
"""
import argparse
import base64
from collections import Counter
from contextlib import redirect_stdout, redirect_stderr
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import http.cookiejar
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import sys
import tempfile
import threading
import time
from urllib.error import HTTPError
from urllib.request import build_opener, HTTPCookieProcessor, ProxyHandler, Request


def validate_database(config):
    if set(config) != {'NAME', 'USER', 'PASSWORD', 'HOST', 'PORT'}:
        raise ValueError('Database JSON must contain NAME, USER, PASSWORD, HOST, PORT only.')
    if not re.fullmatch(r'pontaj_loadtest_[0-9a-f]{12}', config['NAME']):
        raise ValueError('Refusing database without disposable pontaj_loadtest_<12 hex> name.')
    if config['USER'] != config['NAME']:
        raise ValueError('Use a dedicated database role with the same disposable name.')
    if config['HOST'] not in ('127.0.0.1', '::1'):
        raise ValueError('Only a local disposable database is allowed.')
    return {'ENGINE': 'django.db.backends.postgresql', **config,
            'CONN_MAX_AGE': 60, 'CONN_HEALTH_CHECKS': True}


def check_memory(minimum_mib=300):
    meminfo = Path('/proc/meminfo')
    if meminfo.exists():
        available = int(re.search(r'MemAvailable:\s+(\d+)', meminfo.read_text())[1])
        if available < minimum_mib * 1024:
            raise RuntimeError(f'STOP: less than {minimum_mib} MiB available RAM for an additional test backend. '
                               'Use a separate test host or add RAM; production was not modified.')


def summary(samples):
    times = sorted(row['seconds'] for row in samples)
    def percentile(p):
        return round(times[max(0, math.ceil(len(times) * p) - 1)], 3) if times else None
    return {'requests': len(samples), 'failures': sum(not row['ok'] for row in samples),
            'statuses': dict(Counter(str(row['status']) for row in samples)),
            'p50_s': percentile(.5), 'p95_s': percentile(.95), 'max_s': percentile(1)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app-dir', type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--postgres-config', type=Path)
    mode.add_argument('--sqlite-smoke', action='store_true')
    parser.add_argument('--levels', default='25,50,100,200')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    levels = [int(n) for n in args.levels.split(',')]
    if not levels or any(n < 1 or n > 200 for n in levels) or levels != sorted(set(levels)):
        parser.error('Levels must increase, between 1 and 200.')
    if importlib.util.find_spec('gunicorn') is None:
        parser.error('Run with the application Python that has Gunicorn installed.')
    app_dir = args.app_dir.resolve()
    if not (app_dir / 'dataAPI/wsgi.py').is_file():
        parser.error('app-dir must contain dataAPI/wsgi.py.')
    # Refuse overwriting an earlier report.
    with args.output.open('x'):
        pass
    report = {'mode': 'sqlite-smoke-not-capacity' if args.sqlite_smoke else 'postgresql',
              'workers': 1, 'threads': 1 if args.sqlite_smoke else 16,
              'levels': [], 'passed': False,
              'scope': 'HTTP backend only; synthetic data, no production URL, no browser or Nginx.'}
    try:
        check_memory()
        database = validate_database(json.loads(args.postgres_config.read_text())) if args.postgres_config else None
        if database:
            import psycopg
            with psycopg.connect(dbname=database['NAME'], user=database['USER'],
                                 password=database['PASSWORD'], host=database['HOST'],
                                 port=database['PORT'], connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT count(*) FROM information_schema.tables "
                                "WHERE table_schema NOT IN ('pg_catalog', 'information_schema')")
                    if cur.fetchone()[0]:
                        raise RuntimeError('Refusing a nonempty database; create a NEW disposable database.')
        with tempfile.TemporaryDirectory(prefix='pontaj-loadtest-') as folder:
            run(args, app_dir, Path(folder), database, levels, report)
    except Exception as exc:
        # Connection errors may contain passwords/DSNs; report only the class.
        report['error_type'] = type(exc).__name__
        if isinstance(exc, (ValueError, RuntimeError)):
            report['error'] = str(exc)
        print('STOP:', report.get('error', report['error_type']), flush=True)
    finally:
        args.output.write_text(json.dumps(report, indent=2) + '\n')
    return 0 if report['passed'] else 1


def run(args, app_dir, folder, database, levels, report):
    if database is None:
        database = {'ENGINE': 'django.db.backends.sqlite3', 'NAME': str(folder / 'smoke.sqlite3')}
    # Disable .env loading BEFORE importing project settings, including in the
    # Gunicorn child. No live secret, database, mail credential or media path is used.
    settings_source = f'''
import os
from unittest.mock import patch
os.environ['DB_ENGINE'] = 'sqlite'
os.environ['DJANGO_SECRET_KEY'] = {secrets.token_hex(32)!r}
os.environ['PONTAJ_PASSWORD'] = 'synthetic-load-test-only'
os.environ['SENDGRID_API_KEY'] = ''
os.environ['FIREBASE_CREDENTIALS_PATH'] = ''
with patch('dotenv.load_dotenv', return_value=False):
    from dataAPI.settings import *
DATABASES = {{'default': {database!r}}}
DEBUG = False
ALLOWED_HOSTS = ['127.0.0.1', 'localhost']
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
SENDGRID_API_KEY = ''
FIREBASE_CREDENTIALS_PATH = ''
MEDIA_ROOT = {str(folder / 'media')!r}
STATIC_ROOT = {str(folder / 'static')!r}
CACHES = {{'default': {{'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}}}
'''
    settings_file = folder / 'load_settings.py'
    settings_file.write_text(settings_source)
    settings_file.chmod(0o600)
    os.environ['DJANGO_SETTINGS_MODULE'] = 'load_settings'
    sys.path[:0] = [str(folder), str(app_dir)]
    import django
    django.setup()
    from django.core.management import call_command
    from django.db import connections
    from django.utils import timezone
    from ToolApp.models import Users, AppUser, AttendanceSession, PresenceEvent
    from ToolApp.worksites import TEAM_DASHBOARD_WORKSITES
    print('Creating isolated schema and 200 synthetic employees...', flush=True)
    # Historical data migrations can print employee names from repository Excel
    # fixtures even on an empty DB. Keep that output out of the shareable report.
    with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
        call_command('migrate', interactive=False, verbosity=0)
    if Users.objects.exists():
        raise RuntimeError('Expected no employees after migration; refusing to seed.')
    employees = [Users(UserName=f'Load test {i:03}', UserSerie=f'LOAD-{i:03}',
                       UserPin=f'{8000+i}', pin_hash='!') for i in range(200)]
    Users.objects.bulk_create(employees)
    employees = list(Users.objects.order_by('pk'))
    AppUser.objects.bulk_create([
        AppUser(employee=user, username=f'load-{i}', pin_hash='!', login_redirect_path='/team-dashboard')
        for i, user in enumerate(employees)])
    # These fictitious absent people must remain without sessions throughout.
    absentees = [Users(UserName=f'Absent test {i}', UserSerie=f'ABS-{i}', UserPin=f'{9000+i}')
                 for i in range(19)]
    Users.objects.bulk_create(absentees)
    absent_ids = list(Users.objects.filter(UserSerie__startswith='ABS-').values_list('pk', flat=True))
    now = timezone.now()
    day = timezone.localdate()
    site = TEAM_DASHBOARD_WORKSITES[0]
    AttendanceSession.objects.bulk_create([
        AttendanceSession(user_fk=user, work_date=day - timedelta(days=d),
                          in_time=now - timedelta(days=d, hours=8), out_time=now - timedelta(days=d),
                          duration_seconds=8*3600, worksite=site['name'])
        for user in employees for d in range(1, 15)])
    # Real, synthetic JPEG of roughly 40 KB, never a photograph of an employee.
    from PIL import Image
    picture = io.BytesIO()
    Image.effect_noise((240, 240), 80).convert('RGB').save(picture, 'JPEG', quality=85)
    photo = 'data:image/jpeg;base64,' + base64.b64encode(picture.getvalue()).decode()
    report['photo_bytes'] = len(picture.getvalue())
    report['synthetic_employees'] = 200
    report['synthetic_absentees'] = len(absent_ids)
    connections.close_all()
    env = dict(os.environ)
    env['PWD'] = str(app_dir)
    env['PYTHONPATH'] = os.pathsep.join([str(folder), str(app_dir), *sys.path])
    env.pop('GUNICORN_CMD_ARGS', None)
    listener = socket.socket()
    listener.bind(('127.0.0.1', 0))
    listener.listen(2048)
    base = f'http://127.0.0.1:{listener.getsockname()[1]}'
    raw_log = tempfile.TemporaryFile(mode='w+b')
    process = None
    stop = threading.Event()
    monitor_samples = []
    monitor_lock = threading.Lock()
    monitors = []

    def client():
        return build_opener(ProxyHandler({}), HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(opener, route, payload=None, expected=200, state=None):
        started = time.perf_counter()
        status = 'connection-error'
        valid = False
        req = Request(base + route, data=json.dumps(payload).encode() if payload is not None else None,
                      headers={'Content-Type': 'application/json'})
        try:
            try:
                response = opener.open(req, timeout=15)
            except HTTPError as exc:
                response = exc
            with response:
                status = response.code
                body = response.read()
            valid = status == expected
            if state is not None:
                valid = valid and json.loads(body).get('state') == state
        except Exception:
            pass
        return {'status': status, 'ok': valid, 'seconds': time.perf_counter() - started}

    def monitor(route, interval):
        opener = client()
        while not stop.is_set():
            try:
                check_memory(100)
            except RuntimeError:
                report['resource_stop'] = 'Available RAM fell below 100 MiB.'
                process.terminate()
                stop.set()
                break
            sample = request(opener, route)
            with monitor_lock:
                monitor_samples.append(sample)
            stop.wait(interval)

    try:
        process = subprocess.Popen([
            sys.executable, '-m', 'gunicorn', '--config', '/dev/null',
            'dataAPI.wsgi:application', '--chdir', str(app_dir),
            '--bind', f'fd://{listener.fileno()}', '--workers', '1', '--worker-class', 'gthread',
            '--threads', str(report['threads']), '--timeout', '120', '--graceful-timeout', '30',
            '--keep-alive', '5', '--access-logfile', '-', '--error-logfile', '-'],
            cwd=app_dir, env=env, pass_fds=(listener.fileno(),), stdout=raw_log, stderr=raw_log)
        listener.close()
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError('Isolated Gunicorn failed to start.')
            if request(client(), '/api/health/')['ok']:
                break
            time.sleep(.2)
        else:
            raise RuntimeError('Isolated Gunicorn readiness timeout.')
        for route, interval in [('/api/pontaj/stream/', 5)] * 4 + [('/api/health/', 1)]:
            thread = threading.Thread(target=monitor, args=(route, interval), daemon=True)
            thread.start()
            monitors.append(thread)
        for level in levels:
            check_memory(100)
            ids = [user.pk for user in employees[:level]]
            AttendanceSession.objects.filter(work_date=day).delete()
            PresenceEvent.objects.all().delete()
            AttendanceSession.objects.bulk_create([
                AttendanceSession(user_fk=user, work_date=day, in_time=timezone.now() - timedelta(hours=2),
                                  worksite=site['name']) for user in employees[:level]])
            openers = [client() for _ in range(level)]
            entry = {'clients': level, 'phases': {}, 'integrity_ok': False}
            report['levels'].append(entry)

            def phase(name, route, payload=None, expected=200, state=None):
                barrier = threading.Barrier(level)
                def job(i):
                    barrier.wait(timeout=30)
                    return request(openers[i], route, payload(i) if payload else None, expected, state)
                with ThreadPoolExecutor(max_workers=level) as pool:
                    samples = list(pool.map(job, range(level)))
                entry['phases'][name] = summary(samples)
                print(json.dumps({'clients': level, 'phase': name, **entry['phases'][name]}), flush=True)
                if any(not s['ok'] for s in samples):
                    raise RuntimeError(f'{name}: failed requests at {level} clients; stopping ramp.')

            phase('login', '/api/app-auth/login/', lambda i: {'pin': employees[i].UserPin})
            phase('legacy_verify', '/api/auth/verify/', lambda i: {}, expected=401)
            phase('verify', '/api/app-auth/verify/', lambda i: {'route': '/team-dashboard'})
            phase('dashboard', '/api/team-portal/dashboard/')
            def attendance(i):
                return {'worksite': site['name'], 'data_processing_consent': True, 'attendance_photo': photo,
                        'gps': {'lat': site['latitude'], 'lng': site['longitude'], 'accuracy': 5,
                                'captured_at': timezone.now().isoformat()}}
            phase('checkout', '/api/team-portal/attendance/', attendance, state='EXIT')
            sessions = AttendanceSession.objects.filter(user_fk_id__in=ids, work_date=day)
            if (Counter(sessions.values_list('user_fk_id', flat=True)) != Counter(ids)
                    or sessions.filter(out_time__isnull=True).exists()):
                raise RuntimeError('Checkout database state incorrect.')
            if Counter(PresenceEvent.objects.filter(kind='EXIT', user_fk_id__in=ids)
                       .values_list('user_fk_id', flat=True)) != Counter(ids):
                raise RuntimeError('Expected exactly one checkout event per employee.')
            # Respect the application debounce interval before the synthetic re-entry.
            time.sleep(1)
            phase('checkin', '/api/team-portal/attendance/', attendance, state='ENTER')
            if (Counter(sessions.values_list('user_fk_id', flat=True)) != Counter(ids + ids)
                    or Counter(sessions.filter(out_time__isnull=True).values_list('user_fk_id', flat=True)) != Counter(ids)):
                raise RuntimeError('Checkin database state incorrect.')
            if Counter(PresenceEvent.objects.filter(kind='ENTER', user_fk_id__in=ids)
                       .values_list('user_fk_id', flat=True)) != Counter(ids):
                raise RuntimeError('Expected exactly one checkin event per employee.')
            if AttendanceSession.objects.filter(user_fk_id__in=absent_ids).exists():
                raise RuntimeError('Synthetic absent employee unexpectedly clocked in.')
            entry['integrity_ok'] = True
        stop.set()
        for thread in monitors:
            thread.join(timeout=16)
        with monitor_lock:
            report['background_monitors_and_health'] = summary(monitor_samples)
            if report.get('resource_stop'):
                raise RuntimeError(report['resource_stop'])
            if any(not sample['ok'] for sample in monitor_samples):
                raise RuntimeError('A background monitor/health request failed.')
        report['passed'] = True
        report['all_phase_p95_below_2s'] = all(
            phase['p95_s'] < 2 for entry in report['levels'] for phase in entry['phases'].values())
    finally:
        stop.set()
        for thread in monitors:
            thread.join(timeout=16)
        if process is not None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        listener.close()
        connections.close_all()
        # Contains ONLY synthetic data, useful for diagnosing an isolated failure.
        if not report['passed']:
            raw_log.seek(0)
            args.output.with_suffix('.backend.log').write_bytes(raw_log.read())
        raw_log.close()


if __name__ == '__main__':
    raise SystemExit(main())
