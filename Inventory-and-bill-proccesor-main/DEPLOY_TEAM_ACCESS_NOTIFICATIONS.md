# Deploy: acces echipe, conturi AppUser și notificări 07:40

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

## 3. Programarea alertelor la 07:40, 07:55 și 08:10

Editează crontab-ul utilizatorului care rulează aplicația:

```bash
crontab -e
```

Adaugă cele trei execuții (înlocuiește `/var/www/dmxnew` cu calea reală):

```cron
CRON_TZ=Europe/Bucharest
40 7 * * 1-6 cd /var/www/dmxnew/Inventory-and-bill-proccesor-main/dataAPI && /var/www/dmxnew/Inventory-and-bill-proccesor-main/.venv/bin/python manage.py process_attendance_alert_escalations >> /var/log/dmx-team-attendance.log 2>&1
55 7 * * 1-6 cd /var/www/dmxnew/Inventory-and-bill-proccesor-main/dataAPI && /var/www/dmxnew/Inventory-and-bill-proccesor-main/.venv/bin/python manage.py process_attendance_alert_escalations >> /var/log/dmx-team-attendance.log 2>&1
10 8 * * 1-6 cd /var/www/dmxnew/Inventory-and-bill-proccesor-main/dataAPI && /var/www/dmxnew/Inventory-and-bill-proccesor-main/.venv/bin/python manage.py process_attendance_alert_escalations >> /var/log/dmx-team-attendance.log 2>&1
```

Comanda recalculează situația la fiecare nivel, ignoră intern duminica/datele configurate și folosește fusul `Europe/Bucharest`. Constrângerile unice pentru angajat + nivel + zi și pentru emailul centralizat + nivel + zi împiedică duplicatele dacă jobul este lansat de mai multe ori.

Test manual fără email/push:

```bash
python manage.py send_team_attendance_alerts --date 2026-08-28 --no-email --no-push
```

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
