import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/install-pontaj-background.sh'


class BackgroundInstallTests(unittest.TestCase):
    def test_installs_both_jobs_and_verifies_timers(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            units = root / 'units'
            units.mkdir()
            binaries = root / 'bin'
            binaries.mkdir()
            python = root / 'Inventory-and-bill-proccesor-main/dataAPI/.venv/bin/python'
            python.parent.mkdir(parents=True)
            python.write_text('#!/bin/sh\nexit 0\n')
            python.chmod(0o755)
            fake_id = binaries / 'id'
            fake_id.write_text('#!/bin/sh\nprintf "0\\n"\n')
            fake_id.chmod(0o755)
            systemctl = binaries / 'systemctl'
            systemctl.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$SYSTEMCTL_LOG"\n')
            systemctl.chmod(0o755)
            analyze = binaries / 'systemd-analyze'
            analyze.write_text('#!/bin/sh\nprintf "verify\\n" >> "$SYSTEMCTL_LOG"\nexit "${VERIFY_EXIT:-0}"\n')
            analyze.chmod(0o755)
            log = root / 'systemctl.log'
            env = {
                **os.environ, 'PATH': f'{binaries}:/usr/bin:/bin',
                'REPO_DIR': str(root), 'APP_USER': 'test-app',
                'PONTAJ_SYSTEMD_UNIT_DIR': str(units), 'SYSTEMCTL_LOG': str(log),
                'VERIFY_EXIT': '0',
            }
            result = subprocess.run(['bash', str(SCRIPT)], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(len(list(units.iterdir())), 4)
            service = (units / 'pontaj-maintenance.service').read_text()
            self.assertIn(f'ExecStart="{python}" manage.py process_attendance_alert_escalations --maintenance', service)
            self.assertIn('User=test-app', service)
            self.assertIn('TimeoutStartSec=300', service)
            for name in ('pontaj-maintenance.service', 'pontaj-retention.service'):
                working_directory = next(line.partition('=')[2] for line in
                                         (units / name).read_text().splitlines()
                                         if line.startswith('WorkingDirectory='))
                self.assertEqual(working_directory, str(python.parents[2]))
                self.assertTrue(Path(working_directory).is_absolute())
            self.assertIn('03:15:00 Europe/Bucharest', (units / 'pontaj-retention.timer').read_text())
            calls = log.read_text().splitlines()
            self.assertEqual(calls, [
                'verify',
                'daemon-reload',
                'enable --now pontaj-maintenance.timer pontaj-retention.timer',
                'is-active --quiet pontaj-maintenance.timer',
                'is-active --quiet pontaj-retention.timer',
            ])

            # A validation error must stop installation before daemon-reload or
            # enabling timers, rather than leave a seemingly successful deploy.
            log.write_text('')
            result = subprocess.run(['bash', str(SCRIPT)], env={**env, 'VERIFY_EXIT': '1'},
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(log.read_text().splitlines(), ['verify'])


if __name__ == '__main__':
    unittest.main()
