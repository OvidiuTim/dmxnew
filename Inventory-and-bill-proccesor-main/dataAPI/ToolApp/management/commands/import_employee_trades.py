import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from ToolApp.models import Users


DEFAULT_MANIFEST = Path(__file__).resolve().parents[2] / 'data' / 'employee_trades_2026_09_09.json'


def read_manifest(path):
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(data, dict) or data.get('version') != 1:
            raise ValueError('Versiune de manifest invalidă.')
        rows = data['employees']
        if not isinstance(rows, list) or not rows:
            raise ValueError('Lista de angajați este goală sau invalidă.')
        seen = set()
        for row in rows:
            key = row['identity_sha256']
            if not isinstance(key, str) or not re.fullmatch(r'[0-9a-f]{64}', key) or key in seen:
                raise ValueError('Identificator invalid sau repetat în manifest.')
            seen.add(key)
            if not isinstance(row['name'], str) or not row['name'].strip():
                raise ValueError('Nume invalid în manifest.')
            trade = row['trade']
            if not isinstance(trade, str) or not trade.strip() or len(trade) > 100:
                raise ValueError('Meseria trebuie să aibă între 1 și 100 de caractere.')
            old = row['previous_trade']
            if old is not None and not isinstance(old, str):
                raise ValueError('Meserie anterioară invalidă.')
        return data
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise CommandError(f'Manifest invalid: {exc}') from exc


class Command(BaseCommand):
    help = ('Importă numai meseriile din lista verificată Workers_List_teams_EN. '
            'Implicit previzualizează; --apply aplică într-o tranzacție și salvează valorile vechi.')

    def add_arguments(self, parser):
        parser.add_argument('--manifest', type=Path, default=DEFAULT_MANIFEST)
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--require-postgresql', action='store_true')
        parser.add_argument('--backup-dir', type=Path, default=Path(settings.BASE_DIR) / '_backups')

    def handle(self, *args, **options):
        if options['require_postgresql'] and connection.vendor != 'postgresql':
            raise CommandError('Import oprit: conexiunea activă nu este PostgreSQL.')
        manifest = read_manifest(options['manifest'])
        self.stdout.write(f'Baza activă: {connection.vendor}')
        self.stdout.write(f"Poziții în manifest: {len(manifest['employees'])}")
        self.stdout.write('Excluși: ' + ', '.join(manifest.get('excluded_names', [])))
        with transaction.atomic():
            query = Users.objects.filter(person_type=Users.PersonType.EMPLOYEE).only(
                'UserId', 'UserSerie', 'UserName', 'trade')
            if options['apply']:
                query = query.select_for_update()
            employees = {
                hashlib.sha256(employee.UserSerie.encode('utf-8')).hexdigest(): employee
                for employee in query
            }
            problems, changes, matched = [], [], []
            for row in manifest['employees']:
                employee = employees.get(row['identity_sha256'])
                if employee is None:
                    problems.append(f"{row['name']}: identificatorul stabil nu există în baza activă.")
                    continue
                matched.append((employee, row))
                if employee.trade == row['trade']:
                    continue
                if employee.trade != row['previous_trade']:
                    problems.append(f"{row['name']}: meseria locală {employee.trade!r} diferă "
                                    f"de valoarea inițială {row['previous_trade']!r} și de țintă {row['trade']!r}.")
                    continue
                changes.append((employee, row))
            if problems:
                for problem in problems:
                    self.stderr.write(problem)
                raise CommandError(f'{len(problems)} neconcordanțe; nu s-a modificat niciun angajat.')
            self.stdout.write(f'Identificați: {len(matched)}; de modificat: {len(changes)}; '
                              f'deja identici: {len(matched) - len(changes)}')
            for employee, row in changes:
                self.stdout.write(f"  {row['name']} [ID {employee.pk}]: {employee.trade!r} -> {row['trade']!r}")
            if not options['apply']:
                self.stdout.write('DRY-RUN: baza nu a fost modificată. Aplicare: --apply.')
                return
            if not changes:
                self.stdout.write(self.style.SUCCESS('Toate meseriile sunt deja identice. 0 modificări.'))
                return
            backup_dir = options['backup_dir']
            backup_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
            backup_path = backup_dir / f'employee-trades-{stamp}-{uuid.uuid4().hex[:8]}.json'
            backup = dict(
                source=manifest.get('source'), database_vendor=connection.vendor,
                note='Valori anterioare tranzacției; verificați rezultatul comenzii înainte de restaurare.',
                changes=[dict(user_id=e.pk, identity_sha256=r['identity_sha256'], name=r['name'],
                              old_trade=e.trade, new_trade=r['trade']) for e, r in changes])
            # Fail before touching data if a readable recovery record cannot be written.
            with backup_path.open('x', encoding='utf-8') as stream:
                backup_path.chmod(0o600)
                json.dump(backup, stream, ensure_ascii=False, indent=2)
                stream.write('\n')
            self.stdout.write(f'Valori anterioare salvate: {backup_path}')
            for employee, row in changes:
                employee.trade = row['trade']
            Users.objects.bulk_update([e for e, _ in changes], ['trade'], batch_size=300)
            actual = dict(Users.objects.filter(pk__in=[e.pk for e, _ in matched]).values_list('pk', 'trade'))
            if any(actual.get(e.pk) != r['trade'] for e, r in matched):
                raise CommandError('Verificarea după import a eșuat; tranzacția a fost anulată.')
        self.stdout.write(self.style.SUCCESS(
            f'Import finalizat: {len(changes)} meserii modificate; {len(matched)} verificate. '
            'Statutul, echipele și celelalte date au rămas neschimbate.'))
