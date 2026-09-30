#!/usr/bin/env bash
# Install the jobs removed from HTTP requests. Called by deploy.sh after migrate.
set -euo pipefail
REPO_DIR="${REPO_DIR:-/srv/pontaj}"
APP_USER="${APP_USER:-app}"
APP_DIR="$REPO_DIR/Inventory-and-bill-proccesor-main/dataAPI"
UNIT_DIR="${PONTAJ_SYSTEMD_UNIT_DIR:-/etc/systemd/system}"
test "$(id -u)" = 0
test -x "$APP_DIR/.venv/bin/python"
id "$APP_USER" >/dev/null

cat > "$UNIT_DIR/pontaj-maintenance.service" <<EOF
[Unit]
Description=Pontaj attendance maintenance outside HTTP workers
After=network.target postgresql.service

[Service]
Type=oneshot
User=$APP_USER
WorkingDirectory="$APP_DIR"
ExecStart="$APP_DIR/.venv/bin/python" manage.py process_attendance_alert_escalations --maintenance
TimeoutStartSec=300
Nice=10
UMask=0077
EOF
cat > "$UNIT_DIR/pontaj-maintenance.timer" <<'EOF'
[Unit]
Description=Run attendance maintenance every minute
[Timer]
OnCalendar=*-*-* *:*:00
AccuracySec=1s
Persistent=true
[Install]
WantedBy=timers.target
EOF

cat > "$UNIT_DIR/pontaj-retention.service" <<EOF
[Unit]
Description=Pontaj dismissed employee retention outside HTTP workers
After=postgresql.service
[Service]
Type=oneshot
User=$APP_USER
WorkingDirectory="$APP_DIR"
ExecStart="$APP_DIR/.venv/bin/python" manage.py purge_dismissed_employees
TimeoutStartSec=1800
Nice=10
UMask=0077
EOF
cat > "$UNIT_DIR/pontaj-retention.timer" <<'EOF'
[Unit]
Description=Daily employee retention at night
[Timer]
OnCalendar=*-*-* 03:15:00 Europe/Bucharest
AccuracySec=1min
[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now pontaj-maintenance.timer pontaj-retention.timer
systemctl is-active --quiet pontaj-maintenance.timer
systemctl is-active --quiet pontaj-retention.timer
