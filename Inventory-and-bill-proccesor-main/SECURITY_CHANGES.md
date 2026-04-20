# Schimbari de securitate si deploy

## Ce s-a schimbat

- `DEBUG` este citit din `.env` prin `DJANGO_DEBUG`; default este `False`.
- `SECRET_KEY` nu mai este hardcodat; serverul trebuie sa aiba `DJANGO_SECRET_KEY` in `.env`.
- CORS nu mai permite toate originile; foloseste `DJANGO_CORS_ALLOWED_ORIGINS`.
- Toate endpointurile `/api/...` cer cookie/token de admin, cu exceptia:
  - `/api/auth/login/`
  - `/api/auth/verify/`
  - `/api/nfc/scan/` pentru cutiile Raspberry Pi existente
  - `/api/pontaj/clock/` pentru pontaj Android/web cu PIN
- Login-ul Angular seteaza cookie HttpOnly `ptj`; frontendul nu mai salveaza tokenul in `localStorage`.
- `UserPin` nu mai este returnat in `/api/user/`.
- PIN-ul este salvat in `Users.pin_hash`; la migrare, PIN-urile vechi din `UserPin` sunt hash-uite si campul vechi este golit.
- Pontajul Android/web trebuie facut prin `/api/pontaj/clock/`; serverul verifica PIN-ul, decide angajatul si creeaza pontajul.
- Endpointul Raspberry Pi `/api/nfc/scan/` ramane compatibil cu payloadul vechi, inclusiv `content` si maparea UID -> PIN.
- Dupa 5 incercari gresite de PIN pentru acelasi IP/device/UID, serverul blocheaza temporar incercarile si scrie log in `PinAttemptLog`.
- Endpointurile de administrare pontaj, utilizatori, materiale, unelte etc. sunt protejate de middleware-ul `ApiAuthMiddleware`.

## Android

Nu mai cauta angajatul in aplicatie si nu valida PIN-ul local. Trimite doar datele introduse/capturate:

```http
POST https://magazie.dmxconstruction.ro/api/pontaj/clock/
Content-Type: application/json
```

```json
{
  "pin": "1234",
  "device_key": "android-device-id-stabil",
  "worksite": "Tractorului Bloc B2",
  "mode": "manual",
  "gps": {
    "lat": 45.6579,
    "lng": 25.6012,
    "accuracy": 20,
    "captured_at": "2026-04-20T10:30:00Z"
  }
}
```

Pentru soferi trimite `mode: "driver"`; atunci GPS-ul este obligatoriu. Raspunsurile importante:

- `200` cu `state: "ENTER"` sau `state: "EXIT"` inseamna pontaj reusit.
- `429` cu `error_code: "PIN_TEMPORARILY_BLOCKED"` inseamna prea multe PIN-uri gresite; respecta `retry_after_seconds`.
- `400` cu `GPS_REQUIRED_FOR_DRIVER` sau `GPS_CAPTURE_EXPIRED` trebuie afisat utilizatorului.

## Raspberry Pi

Scriptul existent poate ramane neschimbat:

```python
ENDPOINT = "https://magazie.dmxconstruction.ro/api/nfc/scan/"
```

Serverul inca accepta payloadul vechi cu `uid`, `content`, `timestamp`, `reader` si `worksite`. Diferenta este ca serverul compara PIN-ul cu `pin_hash`, nu cu text clar in baza de date.

## Server dupa pull

1. Intra in backend:

```bash
cd /cale/catre/Inventory-and-bill-proccesor-main/dataAPI
```

2. Creeaza/actualizeaza `.env` dupa `.env.example`:

```bash
cp .env.example .env
python - <<'PY'
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
PY
```

Pune cheia generata in `DJANGO_SECRET_KEY` si seteaza `PONTAJ_PASSWORD`.

3. Instaleaza dependinte daca e nevoie si ruleaza migrarile:

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
```

4. Rebuild Angular:

```bash
cd ../FE/newface
npm install
npm run build
```

5. Restart la serviciul Django/gunicorn/uwsgi si la Nginx daca ai modificat configuratia:

```bash
sudo systemctl restart gunicorn
sudo systemctl reload nginx
```

6. Verificari rapide:

```bash
curl -i https://magazie.dmxconstruction.ro/api/user/
curl -i -X POST https://magazie.dmxconstruction.ro/api/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"password":"PAROLA_DIN_ENV"}'
```

Primul trebuie sa dea `401` fara login. Al doilea trebuie sa seteze cookie-ul `ptj`.
