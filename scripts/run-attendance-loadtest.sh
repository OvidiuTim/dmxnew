#!/usr/bin/env bash
# Ubuntu/PostgreSQL: create a disposable role/database; run as the existing app user.
# Never loads the production .env and never sends requests to the public website.
set -Eeuo pipefail

APP_DIR=${APP_DIR:-/srv/pontaj/Inventory-and-bill-proccesor-main/dataAPI}
APP_USER=${APP_USER:-app}
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd -- "$APP_DIR" && pwd)
PYTHON="$APP_DIR/.venv/bin/python"
pause_live=0
if [[ ${1:-} == --pause-live-backend && $# == 1 ]]; then
    pause_live=1
elif [[ $# != 0 ]]; then
    echo 'Usage: run-attendance-loadtest.sh [--pause-live-backend]'
    exit 1
fi
[[ $(id -u) == 0 ]] || { echo 'Run this wrapper with sudo.'; exit 1; }
id "$APP_USER" >/dev/null
[[ -x "$PYTHON" && -f "$SCRIPT_DIR/attendance-loadtest.py" ]]
"$PYTHON" -c 'import gunicorn, psycopg, PIL'
# runuser inherits cwd. /root is inaccessible to app/postgres, and Gunicorn
# enters its initial cwd before applying its own --chdir argument.
cd /
run_dir=$(mktemp -d /var/tmp/pontaj-loadtest.XXXXXXXX)
chown "$APP_USER" "$run_dir"
db_name="pontaj_loadtest_$("$PYTHON" -c 'import secrets; print(secrets.token_hex(6))')"
db_password=$("$PYTHON" -c 'import secrets; print(secrets.token_hex(32))')
role_created=0
db_created=0
restart_live=0
metrics_pid=''
cleanup() {
    local result=$?
    trap - EXIT
    rm -f "$run_dir/database.json"
    if [[ $db_created == 1 ]]; then
        runuser -u postgres -- psql -X -q -d postgres -v ON_ERROR_STOP=1 <<SQL || result=1
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db_name';
SQL
        runuser -u postgres -- dropdb "$db_name" || result=1
    fi
    if [[ $role_created == 1 ]]; then
        runuser -u postgres -- dropuser "$db_name" || result=1
    fi
    if [[ -n "$metrics_pid" ]]; then
        kill "$metrics_pid" 2>/dev/null || true
        wait "$metrics_pid" 2>/dev/null || true
    fi
    if [[ $restart_live == 1 ]]; then
        echo 'Restoring pontaj.service...'
        systemctl start pontaj || result=1
        live_ok=0
        for attempt in 1 2 3 4 5; do
            if curl --fail --max-time 5 -sS https://magazie.dmxconstruction.ro/api/health/; then
                live_ok=1
                break
            fi
            sleep 1
        done
        if [[ $live_ok != 1 ]]; then
            echo 'ATTENTION: live health failed. Check systemctl status pontaj.'
            result=1
        fi
    fi
    echo "Report directory: $run_dir"
    exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

if [[ $pause_live == 1 ]] && systemctl is-active --quiet pontaj; then
    echo 'Temporarily stopping pontaj.service; it will be restored on exit.'
    restart_live=1
    systemctl stop pontaj
fi
available_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
if [[ ${available_kib:-0} -lt 307200 ]]; then
    echo 'STOP: fewer than 300 MiB RAM available. Use a separate test host or add RAM.'
    exit 1
fi
if command -v vmstat >/dev/null; then
    vmstat 1 > "$run_dir/vmstat.log" &
    metrics_pid=$!
fi

# Generated identifiers/password contain only letters, underscores and hex.
# Password goes over stdin, never into the psql process command line.
runuser -u postgres -- psql -X -q -d postgres -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE "$db_name" LOGIN PASSWORD '$db_password' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 24;
SQL
role_created=1
runuser -u postgres -- createdb --owner="$db_name" "$db_name"
db_created=1
umask 077
cat > "$run_dir/database.json" <<JSON
{"NAME":"$db_name","USER":"$db_name","PASSWORD":"$db_password","HOST":"127.0.0.1","PORT":"5432"}
JSON
chown "$APP_USER" "$run_dir/database.json"
unset db_password

# Bound the entire run, including migration and any unexpected stalled request.
runuser -u "$APP_USER" -- timeout --signal=TERM --kill-after=45s 10m \
    "$PYTHON" "$SCRIPT_DIR/attendance-loadtest.py" \
    --app-dir "$APP_DIR" --postgres-config "$run_dir/database.json" \
    --output "$run_dir/report.json"
