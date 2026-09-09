import hashlib
import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from ToolApp.management.commands.import_employee_trades import DEFAULT_MANIFEST, read_manifest
from ToolApp.models import Users


class ImportEmployeeTradesTests(TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / 'manifest.json'
        self.backup_dir = Path(self.directory.name) / 'backups'
        self.first = Users.objects.create(UserName='Mandeep Singh P1111111', UserSerie='stable-one',
                                          trade='Painter', Company='DMX', hourly_rate=25)
        self.second = Users.objects.create(UserName='Mandeep Singh P2222222', UserSerie='stable-two',
                                           trade='JCB operator', employment_status='dismissed')
        self.excluded = Users.objects.create(UserName='Loverpreet Singh', UserSerie='excluded', trade='Helper')
        self.rows = [self.row(self.first, 'Painter | +Helper'), self.row(self.second, 'MEWP operator')]

    def row(self, employee, trade):
        return dict(identity_sha256=hashlib.sha256(employee.UserSerie.encode()).hexdigest(),
                    name='Mandeep Singh', previous_trade=employee.trade, trade=trade)

    def run_import(self, apply=False):
        self.path.write_text(json.dumps(dict(version=1, employees=self.rows)))
        output = StringIO()
        call_command('import_employee_trades', manifest=self.path, apply=apply,
                     backup_dir=self.backup_dir, stdout=output, stderr=StringIO())
        return output.getvalue()

    def test_preview_does_not_write(self):
        self.assertIn('DRY-RUN', self.run_import())
        self.first.refresh_from_db()
        self.assertEqual(self.first.trade, 'Painter')
        self.assertFalse(self.backup_dir.exists())

    def test_apply_matches_stable_identity_preserves_other_fields_and_is_idempotent(self):
        before = list(Users.objects.order_by('pk').values())
        self.assertIn('2 meserii modificate', self.run_import(apply=True))
        after = list(Users.objects.order_by('pk').values())
        self.assertEqual([r['trade'] for r in after], ['Painter | +Helper', 'MEWP operator', 'Helper'])
        for rows in (before, after):
            for row in rows:
                row.pop('trade')
        self.assertEqual(before, after)
        backups = list(self.backup_dir.glob('*.json'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(json.loads(backups[0].read_text())['changes'][0]['old_trade'], 'Painter')
        self.assertIn('0 modificări', self.run_import(apply=True))
        self.assertEqual(len(list(self.backup_dir.glob('*.json'))), 1)

    def test_missing_identity_and_changed_trade_abort_entire_import(self):
        for field, value in [('identity_sha256', 'a' * 64), ('previous_trade', 'Different')]:
            with self.subTest(field=field):
                old = self.rows[1][field]
                self.rows[1][field] = value
                with self.assertRaises(CommandError):
                    self.run_import(apply=True)
                self.first.refresh_from_db()
                self.assertEqual(self.first.trade, 'Painter')
                self.rows[1][field] = old
        self.assertFalse(self.backup_dir.exists())

    def test_duplicate_targets_and_invalid_trade_are_rejected(self):
        original = self.rows.copy()
        for rows in ([original[0], original[0]], [dict(original[0], trade='')],
                     [dict(original[0], trade='x' * 101)]):
            self.rows = rows
            with self.assertRaises(CommandError):
                self.run_import(apply=True)

    def test_failed_post_write_check_rolls_back(self):
        with patch('django.db.models.query.QuerySet.bulk_update', return_value=0):
            with self.assertRaises(CommandError):
                self.run_import(apply=True)
        self.first.refresh_from_db()
        self.assertEqual(self.first.trade, 'Painter')

    def test_postgresql_guard(self):
        with patch('ToolApp.management.commands.import_employee_trades.connection') as db:
            db.vendor = 'sqlite'
            with self.assertRaisesMessage(CommandError, 'nu este PostgreSQL'):
                call_command('import_employee_trades', require_postgresql=True, stdout=StringIO())

    def test_bundled_manifest_has_only_requested_exclusions_and_unique_people(self):
        data = read_manifest(DEFAULT_MANIFEST)
        self.assertEqual(len(data['employees']), 113)
        self.assertEqual(set(data['excluded_names']), {'Sukhwnat Singh', 'Loverpreet Singh'})
        self.assertFalse(set(data['excluded_names']) & {r['name'] for r in data['employees']})
        self.assertEqual(sum(r['sheet'] == 'Left the company' for r in data['employees']), 5)
