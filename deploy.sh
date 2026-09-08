#!/usr/bin/env bash
# =====================================================================
#  deploy.sh - deploy pontaj pe serverul de productie
#
#  Rulare:   sudo bash /srv/pontaj/deploy.sh          (cere confirmare)
#            sudo bash /srv/pontaj/deploy.sh -y       (fara confirmare)
#            sudo FORCE=1 bash /srv/pontaj/deploy.sh  (chiar daca nu-s commituri noi)
#
#  Ordinea e aleasa ca nimic live sa nu fie atins pana cand build-ul nou
#  nu e gata: backup -> fetch -> reset -> build FE -> migrate -> swap FE.
#  Daca pica ceva inainte de swap, siteul vechi ruleaza mai departe.
# =====================================================================
set -Eeuo pipefail

# --- 0. Auto-mutare in /tmp ------------------------------------------
# Scriptul da `git reset --hard` peste propriul fisier, iar bash citeste
# scriptul incremental de pe disc. Daca ar rula din worktree si-ar schimba
# codul sub picioare la jumatatea executiei. De aceea se copiaza in /tmp
# si se re-executa de acolo.
if [ "${DEPLOY_RELOCATED:-0}" != "1" ]; then
    SELF="$(readlink -f "$0")"
    TMP_SELF="$(mktemp /tmp/deploy-pontaj.XXXXXX.sh)"
    cp "$SELF" "$TMP_SELF"
    export DEPLOY_RELOCATED=1
    exec bash "$TMP_SELF" "$@"
fi

# --- 1. Configurare ---------------------------------------------------
REPO_DIR="${REPO_DIR:-/srv/pontaj}"
APP_USER="${APP_USER:-app}"
PG_DB="${PG_DB:-pontaj}"
HEALTH_URL="${HEALTH_URL:-https://magazie.dmxconstruction.ro/pontaj/}"
NODE_HEAP="${NODE_HEAP:-1536}"

APP_DIR="$REPO_DIR/Inventory-and-bill-proccesor-main/dataAPI"
FE_DIR="$REPO_DIR/Inventory-and-bill-proccesor-main/FE/newface"
LIVE_DIR="$REPO_DIR/angular"
BACKUP_ROOT="$REPO_DIR/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/deploy-$STAMP"
PREV_LIVE="$BACKUP_DIR/angular-live-anterior"

ASSUME_YES=0
if [ "${1:-}" = "-y" ] || [ "${1:-}" = "--yes" ]; then ASSUME_YES=1; fi

# --- 2. Stare pentru rollback ----------------------------------------
CRON_OPRIT=0
PONTAJ_OPRIT=0
FE_SCHIMBAT=0
PREV_HEAD=""

titlu() { printf "\n\033[1m=== %s ===\033[0m\n" "$1"; }
ca_app() { sudo -u "$APP_USER" -H "$@"; }

la_eroare() {
    local cod=$?
    trap - ERR
    printf "\n\033[31m!!! EROARE (exit %s) la linia %s !!!\033[0m\n" "$cod" "${BASH_LINENO[0]}"

    if [ "$FE_SCHIMBAT" = 1 ] && [ -d "$PREV_LIVE" ]; then
        echo "  -> restaurez frontendul anterior"
        rm -rf "$LIVE_DIR"
        cp -a "$PREV_LIVE" "$LIVE_DIR"
        systemctl reload nginx || true
    fi
    if [ "$PONTAJ_OPRIT" = 1 ]; then
        echo "  -> pornesc pontaj"
        systemctl start pontaj || true
    fi
    if [ "$CRON_OPRIT" = 1 ]; then
        echo "  -> pornesc cron"
        systemctl start cron || true
    fi

    printf "\nServiciile au fost repornite. Ce NU s-a revenit automat:\n"
    printf "  - codul din git (HEAD anterior: %s)\n" "${PREV_HEAD:-necunoscut}"
    printf "  - migratiile deja aplicate\n"
    printf "\nBackup complet in: %s\n" "$BACKUP_DIR"
    printf "Revenire cod:  cd %s && sudo -u %s git reset --hard %s\n" \
        "$REPO_DIR" "$APP_USER" "${PREV_HEAD:-<hash>}"
    printf "Revenire baza: sudo -u postgres pg_restore --clean --if-exists -d %s %s/pontaj.dump\n" \
        "$PG_DB" "$BACKUP_DIR"
    exit "$cod"
}
trap la_eroare ERR

# --- 3. Verificari preliminare ---------------------------------------
titlu "VERIFICARI"
if [ "$(id -u)" -ne 0 ]; then
    echo "Trebuie rulat cu sudo."; exit 1
fi
for d in "$REPO_DIR/.git" "$APP_DIR" "$FE_DIR" "$APP_DIR/.venv"; do
    if [ ! -e "$d" ]; then echo "Lipseste: $d"; exit 1; fi
done
id "$APP_USER" >/dev/null
LIBER_KB="$(df -Pk "$REPO_DIR" | awk 'NR==2 {print $4}')"
if [ "$LIBER_KB" -lt 1048576 ]; then
    echo "Sub 1 GB liber pe disc ($((LIBER_KB/1024)) MB). Elibereaza spatiu intai."; exit 1
fi
echo "OK - repo, venv, user, $((LIBER_KB/1024)) MB liberi"

# --- 4. Backup --------------------------------------------------------
titlu "BACKUP -> $BACKUP_DIR"
install -d -m 700 "$BACKUP_DIR"

# pg_dump ruleaza ca postgres, care n-are voie in /root; de aia cd /tmp.
( cd /tmp && sudo -u postgres pg_dump --format=custom --no-owner --no-privileges "$PG_DB" ) \
    > "$BACKUP_DIR/pontaj.dump"
test -s "$BACKUP_DIR/pontaj.dump"
pg_restore --list "$BACKUP_DIR/pontaj.dump" >/dev/null
echo "  baza: $(du -h "$BACKUP_DIR/pontaj.dump" | cut -f1)"

cp -p "$APP_DIR/.env" "$BACKUP_DIR/env.backup"
crontab -u "$APP_USER" -l > "$BACKUP_DIR/app.crontab" 2>/dev/null || echo "(fara crontab)" > "$BACKUP_DIR/app.crontab"
cp -p /etc/systemd/system/pontaj.service "$BACKUP_DIR/pontaj.service" 2>/dev/null || true
if [ -d "$LIVE_DIR" ]; then cp -a "$LIVE_DIR" "$PREV_LIVE"; fi
ln -sfn "$BACKUP_DIR" "$BACKUP_ROOT/latest-deploy"
echo "  .env, crontab, unit systemd si frontendul live - salvate"

# --- 5. Fetch si ce urmeaza sa intre ---------------------------------
titlu "GIT FETCH"
cd "$REPO_DIR"
PREV_HEAD="$(ca_app git --no-optional-locks rev-parse HEAD)"
ca_app git --no-optional-locks fetch origin

COMMITURI="$(ca_app git --no-optional-locks log HEAD..origin/main --oneline)"
if [ -z "$COMMITURI" ]; then
    if [ "${FORCE:-0}" != "1" ]; then
        echo "Nimic nou fata de origin/main. (FORCE=1 ca sa rulezi oricum)"
        exit 0
    fi
    echo "Nimic nou, dar FORCE=1 - continui."
else
    printf "Commituri care intra:\n%s\n" "$COMMITURI"
fi

printf "\nFisiere:\n"
ca_app git --no-optional-locks diff --stat HEAD..origin/main | tail -1
MIGRATII_NOI="$(ca_app git --no-optional-locks diff --name-only HEAD..origin/main -- '*/migrations/*.py' || true)"
if [ -n "$MIGRATII_NOI" ]; then
    printf "\nMIGRATII NOI:\n%s\n" "$MIGRATII_NOI"
fi

if [ "$ASSUME_YES" != 1 ]; then
    printf "\nContinui? (scrie: da) "
    read -r RASPUNS </dev/tty
    if [ "$RASPUNS" != "da" ]; then echo "Anulat."; exit 0; fi
fi

# --- 6. Reset la origin/main -----------------------------------------
titlu "RESET"
# Amprentele de dinainte, ca sa stim daca mai trebuie pip install / npm ci.
AMP_REQ_VECHI="$(md5sum "$APP_DIR/requirements.txt" | cut -d' ' -f1)"
AMP_LOCK_VECHI="$(md5sum "$FE_DIR/package-lock.json" | cut -d' ' -f1)"

# Fara `git clean` - ar sterge directoarele de rollback din worktree.
ca_app git --no-optional-locks reset --hard origin/main
ca_app git --no-optional-locks log -1 --oneline

AMP_REQ_NOU="$(md5sum "$APP_DIR/requirements.txt" | cut -d' ' -f1)"
AMP_LOCK_NOU="$(md5sum "$FE_DIR/package-lock.json" | cut -d' ' -f1)"

# --- 7. Backend: dependinte si verificari (inca nimic distructiv) -----
titlu "BACKEND - VERIFICARI"
cd "$APP_DIR"
if [ "$AMP_REQ_VECHI" != "$AMP_REQ_NOU" ]; then
    echo "requirements.txt s-a schimbat - instalez"
    ca_app "$APP_DIR/.venv/bin/pip" install -q -r requirements.txt
else
    echo "requirements.txt neschimbat - sar peste pip"
fi
ca_app "$APP_DIR/.venv/bin/python" manage.py check
ca_app "$APP_DIR/.venv/bin/python" manage.py makemigrations --check --dry-run
echo "OK - fara migratii nedetectate"

# --- 8. Build frontend (inca nu atinge live) -------------------------
titlu "BUILD FRONTEND"
rm -rf "$FE_DIR/dist"
chown -R "$APP_USER:$APP_USER" "$FE_DIR"
if [ "$AMP_LOCK_VECHI" != "$AMP_LOCK_NOU" ] || [ ! -d "$FE_DIR/node_modules" ]; then
    echo "package-lock.json s-a schimbat - npm ci"
    sudo -u "$APP_USER" -H bash -lc "cd '$FE_DIR' && npm ci --prefer-offline --no-audit"
else
    echo "package-lock.json neschimbat - sar peste npm ci"
fi
sudo -u "$APP_USER" -H bash -lc "cd '$FE_DIR' && NODE_OPTIONS=--max-old-space-size=$NODE_HEAP npx ng build --configuration production --base-href /pontaj/ --source-map=false"

BUILD_INDEX="$(find "$FE_DIR/dist" -type f -name index.html | head -n 1)"
if [ -z "$BUILD_INDEX" ]; then echo "Build-ul nu a produs index.html."; exit 1; fi
BUILD_OUT="$(dirname "$BUILD_INDEX")"
echo "OK - $BUILD_OUT"

# --- 9. Migratii (aici incepe downtime-ul) ---------------------------
titlu "MIGRATII"
systemctl stop cron;   CRON_OPRIT=1
systemctl stop pontaj; PONTAJ_OPRIT=1
cd "$APP_DIR"
ca_app "$APP_DIR/.venv/bin/python" manage.py migrate
ca_app "$APP_DIR/.venv/bin/python" manage.py collectstatic --noinput

# --- 10. Publicare frontend ------------------------------------------
titlu "PUBLICARE FRONTEND"
NEW_LIVE="$REPO_DIR/angular-new"
rm -rf "$NEW_LIVE"
cp -a "$BUILD_OUT" "$NEW_LIVE"
test -f "$NEW_LIVE/index.html"
chown -R "$APP_USER:www-data" "$NEW_LIVE"
find "$NEW_LIVE" -type d -exec chmod 755 {} +
find "$NEW_LIVE" -type f -exec chmod 644 {} +
nginx -t

rm -rf "$LIVE_DIR"
mv "$NEW_LIVE" "$LIVE_DIR"
FE_SCHIMBAT=1
echo "OK - copia anterioara ramane in $PREV_LIVE"

# --- 11. Pornire ------------------------------------------------------
titlu "PORNIRE SERVICII"
systemctl start pontaj; PONTAJ_OPRIT=0
systemctl start cron;   CRON_OPRIT=0
systemctl reload nginx

# --- 12. Verificare finala -------------------------------------------
titlu "VERIFICARE"
for s in pontaj cron nginx postgresql; do
    printf "  %-12s %s\n" "$s" "$(systemctl is-active "$s")"
done

COD=000
for i in 1 2 3 4 5; do
    sleep 3
    COD="$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTH_URL" || echo 000)"
    if [ "$COD" = "200" ]; then break; fi
    echo "  incercarea $i: HTTP $COD"
done
printf "  site         HTTP %s\n" "$COD"
if [ "$COD" != "200" ]; then
    echo "Siteul nu raspunde cu 200."; exit 1
fi

cd "$APP_DIR"
ca_app "$APP_DIR/.venv/bin/python" manage.py shell -c "
from django.db import connection
from ToolApp.models import Users, AttendanceSession, PresenceEvent
print('  baza         ' + connection.vendor)
print('  angajati     ' + str(Users.objects.count()))
print('  pontaje      ' + str(AttendanceSession.objects.count()))
print('  evenimente   ' + str(PresenceEvent.objects.count()))
"
CRON_LINII="$(crontab -u "$APP_USER" -l 2>/dev/null | grep -cv '^\s*\(#\|$\)' || true)"
printf "  cron app     %s linii active\n" "$CRON_LINII"

titlu "GATA"
cd "$REPO_DIR"
ca_app git --no-optional-locks log -1 --oneline
printf "Backup: %s\n" "$BACKUP_DIR"
printf "Revenire cod:       cd %s && sudo -u %s git reset --hard %s\n" "$REPO_DIR" "$APP_USER" "$PREV_HEAD"
printf "Revenire frontend:  sudo rm -rf %s && sudo cp -a %s %s && sudo systemctl reload nginx\n" \
    "$LIVE_DIR" "$PREV_LIVE" "$LIVE_DIR"
printf "\nIn browser da Ctrl+Shift+R - index.html poate fi in cache.\n"
