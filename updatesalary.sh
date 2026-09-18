#!/usr/bin/env bash
# Rulare: sudo bash /srv/pontaj/updatesalary.sh
# Opțional: sudo bash /srv/pontaj/updatesalary.sh /cale/alt-excel.xlsx
set -Eeuo pipefail

# Git poate înlocui chiar acest script în timpul execuției.
if [ "${SALARY_RELOCATED:-0}" != 1 ]; then
    TMP_SELF="$(mktemp /tmp/updatesalary-pontaj.XXXXXX.sh)"
    cp -- "$(readlink -f "$0")" "$TMP_SELF"
    export SALARY_RELOCATED=1
    exec bash "$TMP_SELF" "$@"
fi

REPO_DIR="${REPO_DIR:-/srv/pontaj}"
APP_USER="${APP_USER:-app}"
PG_DB="${PG_DB:-pontaj}"
APP_DIR="$REPO_DIR/Inventory-and-bill-proccesor-main/dataAPI"
PYTHON="$APP_DIR/.venv/bin/python"
SALARY_FILE="${1:-${SALARY_FILE:-$APP_DIR/ToolApp/data/Salarii_iulie_lichidare.xlsx}}"
SALARY_FILE="$(realpath -m -- "$SALARY_FILE")"
HEALTH_URL="${HEALTH_URL:-https://magazie.dmxconstruction.ro/api/app-auth/verify/}"
BACKUP_DIR=""
PREV_HEAD=""
PONTAJ_STOPPED=0
CRON_STOPPED=0

ca_app() { sudo -u "$APP_USER" -H "$@"; }
titlu() { printf '\n=== %s ===\n' "$1"; }
cleanup() {
    local code=$?
    trap - EXIT
    if [ "$PONTAJ_STOPPED" = 1 ]; then
        systemctl start pontaj || code=1
    fi
    if [ "$CRON_STOPPED" = 1 ]; then
        systemctl start cron || code=1
    fi
    if [ "$code" -ne 0 ]; then
        printf '\nActualizarea NU s-a terminat. Verifică eroarea de mai sus.\n'
        printf 'Backup / raport: %s\nCommit anterior: %s\n' "${BACKUP_DIR:-necreat}" "${PREV_HEAD:-necunoscut}"
        printf 'Codul, migrările și un import deja finalizat nu se anulează automat.\n'
    fi
    rm -f -- "$0"
    exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

titlu "VERIFICĂRI"
[ "$(id -u)" -eq 0 ] || { echo "Rulează cu sudo."; exit 1; }
[ "$#" -le 1 ] || { echo "Utilizare: sudo bash updatesalary.sh [excel.xlsx]"; exit 1; }
for command in git sudo flock pg_restore systemctl curl realpath; do
    command -v "$command" >/dev/null
done
test -d "$REPO_DIR/.git"
test -x "$PYTHON"
id "$APP_USER" >/dev/null
exec 9>"${SALARY_LOCK_FILE:-/run/lock/pontaj-updatesalary.lock}"
flock -n 9 || { echo "Alt import de salarii rulează deja."; exit 1; }
cd "$REPO_DIR"
test -z "$(ca_app git status --porcelain --untracked-files=no)" || {
    echo "Există modificări locale în fișierele urmărite de Git. Rezolvă-le înainte de actualizare."
    exit 1
}
[ "$(ca_app git branch --show-current)" = main ] || { echo "Repo-ul trebuie să fie pe ramura main."; exit 1; }
PREV_HEAD="$(ca_app git rev-parse HEAD)"

titlu "BACKUP"
BACKUP_DIR="$REPO_DIR/backups/salary-$(date +%Y%m%d-%H%M%S)-$$"
install -d -m 700 "$BACKUP_DIR"
# Raportul și dumpul conțin date salariale; acces doar root.
umask 077
exec > >(tee "$BACKUP_DIR/update.log") 2>&1
cd "$APP_DIR"
ca_app env SALARY_EXPECTED_DB="$PG_DB" "$PYTHON" manage.py shell -c '
import os
from django.db import connection
assert connection.vendor == "postgresql", "Scriptul necesită PostgreSQL, ca deploy.sh"
assert connection.settings_dict["NAME"] == os.environ["SALARY_EXPECTED_DB"], "PG_DB diferă de baza aplicației"
'
(cd /tmp && sudo -u postgres pg_dump --format=custom --no-owner --no-privileges "$PG_DB") > "$BACKUP_DIR/pontaj.dump"
test -s "$BACKUP_DIR/pontaj.dump"
pg_restore --list "$BACKUP_DIR/pontaj.dump" >/dev/null
cp -p "$APP_DIR/.env" "$BACKUP_DIR/env.backup"
printf '%s\n' "$PREV_HEAD" > "$BACKUP_DIR/previous-head.txt"

titlu "GIT PULL"
cd "$REPO_DIR"
ca_app git pull --ff-only origin main
ca_app git log -1 --oneline
# Continuă și dacă Git este deja la zi: Excelul trebuie reaplicat.
test -f "$SALARY_FILE" || { echo "Lipsește Excelul: $SALARY_FILE"; exit 1; }
ca_app test -r "$SALARY_FILE"
cp -- "$SALARY_FILE" "$BACKUP_DIR/source.xlsx"

titlu "DEPENDENȚE ȘI VERIFICĂRI BACKEND"
cd "$APP_DIR"
ca_app "$PYTHON" -m pip install -q -r requirements.txt
ca_app "$PYTHON" manage.py check
ca_app "$PYTHON" manage.py makemigrations --check --dry-run
# Parsează întregul Excel înainte de oprirea serviciilor, inclusiv formulele.
ca_app "$PYTHON" -c 'import sys; from ToolApp.salary_import import parse_salary_files; print("Rânduri salariale:", len(parse_salary_files([sys.argv[1]])))' "$SALARY_FILE"

titlu "MIGRĂRI ȘI IMPORT"
if systemctl is-active --quiet cron; then
    CRON_STOPPED=1
    systemctl stop cron
fi
PONTAJ_STOPPED=1
systemctl stop pontaj
ca_app "$PYTHON" manage.py migrate --noinput
ca_app "$PYTHON" manage.py collectstatic --noinput
ca_app "$PYTHON" manage.py import_employee_salaries "$SALARY_FILE" --require-matches --apply

titlu "REPORNIRE BACKEND"
systemctl start pontaj
PONTAJ_STOPPED=0
if [ "$CRON_STOPPED" = 1 ]; then
    systemctl start cron
    CRON_STOPPED=0
fi
systemctl is-active --quiet pontaj
HTTP_CODE=000
for attempt in 1 2 3 4 5; do
    HTTP_CODE="$(curl --connect-timeout 5 --max-time 15 -sS -X POST -H 'Content-Type: application/json' --data '{}' -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
    # /api/app-auth/verify/ întoarce 401 fără autentificare.
    if [ "$HTTP_CODE" = 200 ] || [ "$HTTP_CODE" = 401 ]; then break; fi
    sleep 3
done
if [ "$HTTP_CODE" != 200 ] && [ "$HTTP_CODE" != 401 ]; then
    echo "Backendul nu răspunde corect: HTTP $HTTP_CODE"
    exit 1
fi
titlu "SALARII ACTUALIZATE"
printf 'Backend: HTTP %s\nBackup și raport: %s\n' "$HTTP_CODE" "$BACKUP_DIR"
printf 'Verifică în raport numele negăsite și asocierile ambigue, dacă există.\n'
