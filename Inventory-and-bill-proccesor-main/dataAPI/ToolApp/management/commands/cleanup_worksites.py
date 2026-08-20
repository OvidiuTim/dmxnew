import json
from collections import Counter
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from ToolApp.models import AttendanceSession, EmployeeTeam, PresenceEvent
from ToolApp.worksites import ACCEPTED_WORKSITES, match_worksite


class Command(BaseCommand):
    help = "Standardizează șantierele istorice. Implicit rulează doar în mod previzualizare."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Aplică modificările. Fără acest flag, comanda doar afișează planul.",
        )
        parser.add_argument(
            "--backup-dir",
            default=str(Path(settings.BASE_DIR) / "backups" / "worksites"),
            help="Directorul în care se salvează copia JSON înainte de aplicare.",
        )
        parser.add_argument(
            "--details-limit",
            type=int,
            default=100,
            help="Numărul maxim de modificări individuale afișate în terminal.",
        )

    def handle(self, *args, **options):
        apply_changes = bool(options["apply"])
        details_limit = max(0, int(options["details_limit"]))
        sessions = list(
            AttendanceSession.objects.select_related("user_fk")
            .order_by("user_fk_id", "work_date", "in_time", "id")
        )
        events = list(
            PresenceEvent.objects.select_related("user_fk")
            .order_by("user_fk_id", "timestamp", "id")
        )
        teams = list(EmployeeTeam.objects.order_by("id"))

        session_changes, session_unresolved, resolved_by_day = self._plan_sessions(sessions)
        event_changes, event_unresolved = self._plan_events(events, resolved_by_day)
        team_changes, team_unresolved = self._plan_teams(teams)
        changes = session_changes + event_changes + team_changes
        unresolved = session_unresolved + event_unresolved + team_unresolved

        self.stdout.write(self.style.MIGRATE_HEADING("Previzualizare standardizare șantiere"))
        self.stdout.write(f"Denumiri acceptate: {len(ACCEPTED_WORKSITES)}")
        self.stdout.write(f"Pontări analizate: {len(sessions)}")
        self.stdout.write(f"Evenimente analizate: {len(events)}")
        self.stdout.write(f"Echipe analizate: {len(teams)}")
        self.stdout.write(self.style.WARNING(f"Valori care urmează să fie modificate: {len(changes)}"))
        self.stdout.write(self.style.WARNING(f"Valori care nu au putut fi rezolvate: {len(unresolved)}"))
        self._print_mapping_summary(changes)
        self._print_details(changes, details_limit)
        self._print_unresolved(unresolved)

        if not apply_changes:
            self.stdout.write("")
            self.stdout.write(self.style.NOTICE(
                "Nu s-a modificat baza de date. Rulează din nou cu --apply pentru backup și aplicare."
            ))
            return

        backup_path = self._create_backup(options["backup_dir"], sessions, events, teams, changes, unresolved)
        self.stdout.write(self.style.SUCCESS(f"Copie de siguranță creată: {backup_path}"))

        with transaction.atomic():
            for item in changes:
                if item["model"] == "AttendanceSession":
                    AttendanceSession.objects.filter(pk=item["id"]).update(worksite=item["new"])
                elif item["model"] == "PresenceEvent":
                    PresenceEvent.objects.filter(pk=item["id"]).update(worksite=item["new"])
                else:
                    EmployeeTeam.objects.filter(pk=item["id"]).update(default_worksite=item["new"])

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Standardizare finalizată: {len(changes)} valori modificate."))
        if unresolved:
            self.stdout.write(self.style.WARNING(
                f"Au rămas {len(unresolved)} valori nerezolvate. Detaliile sunt și în backup."
            ))
        else:
            self.stdout.write(self.style.SUCCESS("Toate locațiile au fost rezolvate."))

    def _plan_sessions(self, sessions):
        changes = []
        unresolved = []
        resolved_by_day = {}
        for session in sessions:
            old = str(session.worksite or "").strip()
            target = match_worksite(old)
            source = "alias"
            if not target:
                target = resolved_by_day.get((session.user_fk_id, session.work_date - timedelta(days=1)))
                source = "ziua anterioară"
            if target:
                resolved_by_day[(session.user_fk_id, session.work_date)] = target
                if old != target:
                    changes.append(self._change(
                        "AttendanceSession", session.id, old, target, source,
                        employee=session.user_fk.UserName, date=session.work_date.isoformat(),
                    ))
            else:
                unresolved.append(self._unresolved(
                    "AttendanceSession", session.id, old,
                    employee=session.user_fk.UserName, date=session.work_date.isoformat(),
                ))
        return changes, unresolved, resolved_by_day

    def _plan_events(self, events, resolved_by_day):
        changes = []
        unresolved = []
        for event in events:
            old = str(event.worksite or "").strip()
            event_day = timezone.localtime(event.timestamp).date()
            target = match_worksite(old)
            source = "alias"
            if not target:
                target = resolved_by_day.get((event.user_fk_id, event_day))
                source = "pontarea aceleiași zile"
            if not target:
                target = resolved_by_day.get((event.user_fk_id, event_day - timedelta(days=1)))
                source = "ziua anterioară"
            if target:
                if old != target:
                    changes.append(self._change(
                        "PresenceEvent", event.id, old, target, source,
                        employee=event.user_fk.UserName, date=event_day.isoformat(),
                    ))
            else:
                unresolved.append(self._unresolved(
                    "PresenceEvent", event.id, old,
                    employee=event.user_fk.UserName, date=event_day.isoformat(),
                ))
        return changes, unresolved

    def _plan_teams(self, teams):
        changes = []
        unresolved = []
        for team in teams:
            old = str(team.default_worksite or "").strip()
            if not old:
                continue
            target = match_worksite(old)
            if target:
                if old != target:
                    changes.append(self._change(
                        "EmployeeTeam", team.id, old, target, "alias", employee=team.name,
                    ))
            else:
                unresolved.append(self._unresolved(
                    "EmployeeTeam", team.id, old, employee=team.name,
                ))
        return changes, unresolved

    @staticmethod
    def _change(model, identifier, old, new, source, **context):
        return {"model": model, "id": identifier, "old": old, "new": new, "source": source, **context}

    @staticmethod
    def _unresolved(model, identifier, value, **context):
        return {"model": model, "id": identifier, "value": value, **context}

    def _print_mapping_summary(self, changes):
        if not changes:
            return
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_LABEL("Rezumat transformări:"))
        counter = Counter((item["old"] or "<gol>", item["new"], item["source"]) for item in changes)
        for (old, new, source), count in counter.most_common():
            self.stdout.write(f"  {count:>5} × {old!r} -> {new!r} ({source})")

    def _print_details(self, changes, limit):
        if not changes or not limit:
            return
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_LABEL("Detalii modificări:"))
        for item in changes[:limit]:
            context = " · ".join(str(item[key]) for key in ("employee", "date") if item.get(key))
            self.stdout.write(
                f"  {item['model']} #{item['id']} {context}: {item['old'] or '<gol>'!r} -> {item['new']!r}"
            )
        if len(changes) > limit:
            self.stdout.write(f"  ... încă {len(changes) - limit} modificări sunt incluse în backup.")

    def _print_unresolved(self, unresolved):
        if not unresolved:
            return
        self.stdout.write("")
        self.stdout.write(self.style.ERROR("Locații nerezolvate:"))
        counter = Counter(item["value"] or "<gol>" for item in unresolved)
        for value, count in counter.most_common():
            self.stdout.write(f"  {count:>5} × {value!r}")

    def _create_backup(self, directory, sessions, events, teams, changes, unresolved):
        backup_dir = Path(directory).expanduser().resolve()
        backup_dir.mkdir(parents=True, exist_ok=True)
        timestamp = timezone.localtime().strftime("%Y%m%d-%H%M%S-%f")
        path = backup_dir / f"worksites-backup-{timestamp}.json"
        payload = {
            "created_at": timezone.localtime().isoformat(),
            "accepted_worksites": list(ACCEPTED_WORKSITES),
            "changes": changes,
            "unresolved": unresolved,
            "before": {
                "attendance_sessions": [
                    {"id": row.id, "user_id": row.user_fk_id, "work_date": row.work_date.isoformat(), "worksite": row.worksite}
                    for row in sessions
                ],
                "presence_events": [
                    {"id": row.id, "user_id": row.user_fk_id, "timestamp": row.timestamp.isoformat(), "worksite": row.worksite}
                    for row in events
                ],
                "employee_teams": [
                    {"id": row.id, "name": row.name, "default_worksite": row.default_worksite}
                    for row in teams
                ],
            },
        }
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)
        return path
