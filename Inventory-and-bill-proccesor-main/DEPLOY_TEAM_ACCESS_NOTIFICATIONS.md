# Deploy: acces echipe, conturi AppUser și notificări 07:30

## 1. Backend și migrații

Din rădăcina `Inventory-and-bill-proccesor-main` de pe server:

```bash
source .venv/bin/activate
python -m pip install -r dataAPI/requirements.txt
cd dataAPI
python manage.py check
python manage.py migrate
python manage.py sync_app_users
python manage.py collectstatic --noinput
```

La primul deploy care include migrarea `ToolApp.0082`, comanda `migrate` importă
automat și o singură dată datele pentru „Ajutor bilet acasă”. În terminal sunt
afișate totalul rândurilor, angajații actualizați/nemodificați și listele pentru
negăsiți, ambigui și valori ignorate. Fiecare câmp este procesat independent:
celulele goale nu blochează celelalte valori valide, iar o valoare invalidă este
raportată și ignorată numai pentru câmpul ei. Raportul separă data angajării,
eligibilitatea și istoricul biletului. Importul nu este legat de Gunicorn.

După migrare, verificarea idempotentă fără scriere se poate repeta cu:

```bash
python manage.py import_home_ticket_benefits
python manage.py showmigrations ToolApp | tail -5
```

Prima comandă trebuie să afișeze `DRY-RUN`; pentru angajații deja importați,
aceștia apar la „deja actualizați și nemodificați”. Păstrează ieșirea completă a
migrării pentru corectarea manuală a angajaților negăsiți, a potrivirilor ambigue
sau a valorilor ignorate.

`sync_app_users` poate fi rulat de mai multe ori. Nu creează dubluri, reactivează contul când angajatul redevine activ, actualizează hash-ul PIN-ului și dezactivează contul angajatului demis/inactiv.

## 2. Configurarea emailului și Firebase în Django

În fișierul `.env` al backendului:

```dotenv
SENDGRID_API_KEY=valoarea_din_sendgrid
DEFAULT_FROM_EMAIL=no-reply@dmxconstruction.ro
FIREBASE_CREDENTIALS_PATH=/etc/dmx/firebase-service-account.json
TEAM_ALERT_NON_WORKING_WEEKDAYS=7
TEAM_ALERT_NON_WORKING_DATES=2026-12-25,2026-12-26
```

Fișierul Firebase este cheia JSON de service account din proiectul Firebase. Nu se copiază în Git:

```bash
sudo install -o www-data -g www-data -m 600 firebase-service-account.json /etc/dmx/firebase-service-account.json
```

## 3. Întreținere separată de cererile web

`deploy.sh` instalează și pornește acum `pontaj-maintenance.timer` și
`pontaj-retention.timer`. Nu mai este executată întreținere globală sau ștergere
istorică în cererile de login/portal. Timerul de pontaj pornește o verificare la
fiecare minut; regulile existente păstrează orele de 07:30, 07:55, 08:10 și 18:00,
fusul Europe/Bucharest și excluderea zilelor nelucrătoare. Execuțiile ratate sunt
recuperate la următoarea rulare, fără ca un utilizator să deschidă aplicația.

Pentru un deploy manual, după migrații, înainte de a considera publicarea completă:

```bash
sudo REPO_DIR=/srv/pontaj APP_USER=app bash /srv/pontaj/scripts/install-pontaj-background.sh
sudo systemctl restart pontaj
systemctl list-timers pontaj-maintenance.timer pontaj-retention.timer
journalctl -u pontaj-maintenance.service --since today --no-pager
curl --fail --max-time 10 https://magazie.dmxconstruction.ro/api/health/
```

Endpointul trebuie să returneze `{"ok": true}`. Un răspuns 200 de la `/pontaj/`
confirmă numai servirea Angular, nu disponibilitatea backendului.

Intrările cron existente pentru `process_attendance_alert_escalations` rămân
compatibile și folosesc același lock ca timerul dacă rulează sub același utilizator
`app`. Se pot elimina după verificarea timerului; nu programa separat
`send_team_attendance_alerts`, care nu participă la acest lock. O execuție lentă
nu creează o coadă de procese suprapuse. Procesul timerului are o limită de 5 minute,
iar eșecurile apar în jurnalul systemd.

Retenția angajaților demiși păstrează pragul de doi ani și rulează la 03:15
Europe/Bucharest. Timerul de retenție nu recuperează rulări ratate în timpul zilei.
La rollback spre o versiune fără parametrul `--maintenance`, oprește timerul nou
și restaurează programarea anterioară.

Test fără email/push:

```bash
sudo -u app /srv/pontaj/Inventory-and-bill-proccesor-main/dataAPI/.venv/bin/python \
  /srv/pontaj/Inventory-and-bill-proccesor-main/dataAPI/manage.py \
  process_attendance_alert_escalations --maintenance --no-email --no-push
```

Această comandă modifică marcajele/alertele de pontaj; pentru testele automate
folosește `manage.py test`, care creează o bază separată.

## 3.1 Reguli de escaladare implementate

- La ora Nivelului 2 (implicit 08:10) toți nepontații sunt trecuți automat absenți; șefii de echipă și Nivel 1 nu mai pot modifica statusul după această oră.
- Marcarea manuală „Marchează lipsă” (Nivel 1 sau șef de echipă) escaladează imediat cazul la Nivel 2, fără să aștepte ora programată.
- Nivel 1 și Nivel 2 văd liste globale, la nivel de companie: `/api/team-portal/missing-today/` (Vezi lipsă) și `/api/team-portal/absent-today/` (Lipsă azi).
- Drepturile de Nivel 1/Nivel 2 vin din configurarea alertelor (`/pontaj/alerte`), nu din calitatea de șef de echipă.

## 4. Build frontend web

```bash
cd ../FE/newface
npm ci
npm run build -- --configuration production
```

Publică directorul `dist/newface` prin configurația Nginx folosită deja de aplicație.

## 5. Configurarea și buildul Android

Valorile publice de identificare Firebase se pun în `~/.gradle/gradle.properties` sau în variabilele de mediu ale CI, nu în surse:

```properties
FIREBASE_APPLICATION_ID=1:000000000000:android:xxxxxxxxxxxxxxxx
FIREBASE_API_KEY=AIza...
FIREBASE_PROJECT_ID=proiect-firebase
FIREBASE_SENDER_ID=000000000000
```

Apoi:

```bash
cd /cale/catre/android_dmx/dmx_android
./gradlew clean assembleRelease
```

APK-ul rezultat este în `app/build/outputs/apk/release/`. Utilizatorul trebuie să accepte permisiunea Android pentru notificări. Tokenul este înregistrat după login și este asociat prin API cu angajatul și `device_key`; tokenurile respinse de Firebase sunt dezactivate automat.

## 6. Restart și verificare

```bash
sudo systemctl restart gunicorn
sudo systemctl reload nginx
sudo systemctl status gunicorn --no-pager
```

Verificări recomandate:

```bash
python manage.py showmigrations ToolApp | tail
python manage.py sync_app_users
python manage.py test ToolApp.test_team_access_and_alerts ToolApp.test_module_access_api
tail -f /var/log/dmx-team-attendance.log
```

Nu se introduc PIN-uri, parole SendGrid sau chei Firebase în comandă, în APK ori în repository.
