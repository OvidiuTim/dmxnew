import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


spec = importlib.util.spec_from_file_location(
    'attendance_loadtest', Path(__file__).resolve().parents[1] / 'scripts/attendance-loadtest.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LoadTestIsolationTests(unittest.TestCase):
    def test_refuses_production_names_roles_and_remote_databases(self):
        fixture = {'NAME': 'pontaj_loadtest_123456abcdef', 'USER': 'pontaj_loadtest_123456abcdef',
                   'PASSWORD': 'synthetic', 'HOST': '127.0.0.1', 'PORT': '5432'}
        self.assertEqual(module.validate_database(fixture)['ENGINE'], 'django.db.backends.postgresql')
        for change in ({'NAME': 'pontaj'}, {'NAME': 'db.sqlite3'}, {'USER': 'postgres'},
                       {'HOST': '178.128.194.197'}, {'OPTIONS': {}}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                module.validate_database({**fixture, **change})

    def test_report_counts_http_success_with_wrong_state_as_failure(self):
        result = module.summary([
            {'seconds': .1, 'status': 200, 'ok': True},
            {'seconds': 3, 'status': 200, 'ok': False},
            {'seconds': 15, 'status': 'connection-error', 'ok': False},
        ])
        self.assertEqual(result['failures'], 2)
        self.assertEqual(result['p95_s'], 15)
        self.assertEqual(result['statuses']['200'], 2)

    def test_server_wrapper_restores_service_on_success_failure_and_low_memory(self):
        script = Path(__file__).resolve().parents[1] / 'scripts/run-attendance-loadtest.sh'
        for test_exit, available, workers, threads in ((0, 400000, 1, 16), (1, 400000, 1, 16),
                                                      (0, 100000, 1, 16), (0, 400000, 2, 8)):
            with self.subTest(test_exit=test_exit, available=available, workers=workers), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                binaries = root / 'bin'
                binaries.mkdir()
                app = root / 'app'
                python = app / '.venv/bin/python'
                python.parent.mkdir(parents=True)

                def executable(path, body):
                    path.write_text('#!/bin/bash\n' + body + '\n')
                    path.chmod(0o755)

                executable(python, '''case "$2" in
*token_hex\(6\)*) echo 123456abcdef;;
*token_hex\(32\)*) echo 0123456789abcdef;;
esac''')
                executable(binaries / 'id', 'echo 0')
                executable(binaries / 'chown', 'exit 0')
                executable(binaries / 'mktemp', 'mkdir "$TEST_RUN_DIR"; echo "$TEST_RUN_DIR"')
                executable(binaries / 'awk', 'echo "$TEST_AVAILABLE"')
                executable(binaries / 'vmstat', 'exec sleep 60')
                executable(binaries / 'curl', 'echo \'{"ok":true}\'')
                executable(binaries / 'systemctl', '''echo "systemctl $*" >> "$TEST_CALLS"
case "$1" in
is-active) test "$(cat "$TEST_STATE")" = active;;
stop) echo inactive > "$TEST_STATE";;
start) echo active > "$TEST_STATE";;
esac''')
                executable(binaries / 'runuser', '''echo "runuser-cwd=$PWD" >> "$TEST_CALLS"
echo "runuser $*" >> "$TEST_CALLS"
if [[ "$4" == psql ]]; then cat >/dev/null; fi
if [[ "$4" == timeout ]]; then exit "$TEST_EXIT"; fi
exit 0''')
                state = root / 'state'
                state.write_text('active')
                calls = root / 'calls'
                result = subprocess.run(['bash', str(script), '--pause-live-backend'],
                    env={**os.environ, 'PATH': f'{binaries}:/usr/bin:/bin', 'APP_DIR': str(app),
                         'APP_USER': 'test-app', 'TEST_RUN_DIR': str(root / 'run'),
                         'TEST_CALLS': str(calls), 'TEST_STATE': str(state),
                         'LOADTEST_WORKERS': str(workers), 'LOADTEST_THREADS': str(threads),
                         'TEST_EXIT': str(test_exit), 'TEST_AVAILABLE': str(available)},
                    capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, 1 if test_exit or available < 307200 else 0,
                                 result.stdout + result.stderr)
                self.assertEqual(state.read_text().strip(), 'active')
                recorded = calls.read_text()
                self.assertIn('systemctl stop pontaj', recorded)
                self.assertIn('systemctl start pontaj', recorded)
                self.assertFalse((root / 'run/database.json').exists())
                if available >= 307200:
                    self.assertIn(f'--workers {workers} --threads {threads}', recorded)
                    self.assertIn('runuser-cwd=/\n', recorded)
                    self.assertIn('dropdb pontaj_loadtest_123456abcdef', recorded)
                    self.assertIn('dropuser pontaj_loadtest_123456abcdef', recorded)
                else:
                    self.assertNotIn('createdb', recorded)


if __name__ == '__main__':
    unittest.main()
