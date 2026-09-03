# Migrare Django de la SQLite la PostgreSQL

Acest proiect păstrează SQLite ca fallback local. Dacă `DB_ENGINE` lipsește sau este
`sqlite`, Django folosește în continuare `dataAPI/db.sqlite3`. Dacă
`DB_ENGINE=postgresql`, toate variabilele PostgreSQL de mai jos sunt obligatorii;
aplicația refuză să pornească dacă una lipsește, pentru a nu folosi accidental o
bază greșită.

## Configurare

Adaugă în `.env` (fișier ignorat de Git), fără a suprascrie secretele existente:

```dotenv
DB_ENGINE=postgresql
DB_NAME=dmx_production
DB_USER=dmx_app
DB_PASSWORD=replace-with-a-strong-secret
DB_HOST=127.0.0.1
DB_PORT=5432
DB_CONN_MAX_AGE=60
```

`DB_CONN_MAX_AGE` este opțional și are valoarea implicită `60` de secunde.
Verificarea conexiunii înainte de reutilizare este activată pentru PostgreSQL.
Aceste două opțiuni nu sunt aplicate fallback-ului SQLite.

Cu limita PostgreSQL de 30 conexiuni și maximum 8 conexiuni persistente Gunicorn,
aplicația folosește cel mult 26,7% din limită și păstrează o rezervă de 22. Numărul
real trebuie calculat ca `workers × threads`; configurația serviciului trebuie să
garanteze că produsul nu depășește 8.

Instalare:

```bash
cd /cale/catre/dmxnew/Inventory-and-bill-proccesor-main/dataAPI
../.venv/bin/python -m pip install -r requirements.txt
```

Driverul folosit este `psycopg[binary]>=3.2,<4`. Fișierul activ indicat de
documentația de deploy este `dataAPI/requirements.txt`; copia
`dataAPI/dataAPI/requirements.txt` a fost actualizată și ea pentru consistență.

## PostgreSQL local cu Docker Compose

Fișierul `docker-compose.postgresql.yml` pornește PostgreSQL 16. Completează cele
șase variabile în `.env`, apoi rulează:

```bash
docker compose -f docker-compose.postgresql.yml up -d --wait
docker compose -f docker-compose.postgresql.yml ps
```

Oprire fără ștergerea datelor:

```bash
docker compose -f docker-compose.postgresql.yml stop
```

Nu folosi `down -v` dacă vrei să păstrezi baza locală. Pentru o probă izolată pe
alt port se pot furniza variabile numai comenzii Compose și comenzilor Django.

## Export sigur din SQLite

În timpul exportului final oprește temporar scrierile în aplicație. Directorul de
lucru și fixture-urile sunt ignorate de Git și trebuie păstrate cu acces restrictiv.

```bash
cd /cale/catre/dmxnew/Inventory-and-bill-proccesor-main/dataAPI
mkdir -p .postgresql-migration
chmod 700 .postgresql-migration
sha256sum db.sqlite3
DB_ENGINE=sqlite ../.venv/bin/python manage.py check
DB_ENGINE=sqlite ../.venv/bin/python manage.py dumpdata \
  --all \
  --natural-foreign \
  --natural-primary \
  --exclude contenttypes \
  --exclude auth.permission \
  --exclude sessions \
  --exclude admin.logentry \
  --indent 2 \
  --output .postgresql-migration/sqlite-data.json
sha256sum db.sqlite3
```

Cele două hash-uri trebuie să fie identice. Sunt excluse tipurile de conținut,
permisiunile generate automat, sesiunile și jurnalul admin care depinde de
tipurile de conținut. `migrate` recreează tipurile și permisiunile corecte în
PostgreSQL. Utilizatorii, grupurile și relațiile lor cu permisiunile rămân în
fixture; cheile naturale le leagă de permisiunile regenerate.

## Crearea schemei și importul

Ținta trebuie să fie o bază PostgreSQL nouă, fără date de business. După ce
valorile PostgreSQL sunt active în `.env`:

```bash
../.venv/bin/python manage.py check
../.venv/bin/python manage.py migrate --noinput
../.venv/bin/python manage.py showmigrations
../.venv/bin/python manage.py loaddata .postgresql-migration/sqlite-data.json
../.venv/bin/python manage.py reset_postgresql_sequences
```

Nu rula `loaddata` peste o bază PostgreSQL deja folosită în producție. Comanda
`reset_postgresql_sequences` refuză să ruleze pe SQLite și reașază toate
secvențele modelelor după ID-urile importate.

## Verificări după import

Comanda următoare deschide SQLite în mod read-only, compară numărul de rânduri
pentru toate modelele `ToolApp` și pentru utilizatorii/grupurile Django, verifică
cheile străine SQLite, constrângerile și indexurile PostgreSQL și toate
secvențele. Opțiunea `--test-write` creează temporar un angajat și un `AppUser`,
verifică ID-urile și autentificarea PIN, apoi face rollback; rândurile nu rămân,
dar secvențele PostgreSQL avansează normal.

```bash
../.venv/bin/python manage.py verify_postgresql_copy \
  --sqlite-path db.sqlite3 \
  --test-write
```

Pentru o comparație semantică a tuturor valorilor importate:

```bash
../.venv/bin/python manage.py dumpdata \
  --all \
  --natural-foreign \
  --natural-primary \
  --exclude contenttypes \
  --exclude auth.permission \
  --exclude sessions \
  --exclude admin.logentry \
  --indent 2 \
  --output .postgresql-migration/postgresql-data.json
../.venv/bin/python manage.py compare_data_fixtures \
  .postgresql-migration/sqlite-data.json \
  .postgresql-migration/postgresql-data.json
```

Comparatorul normalizează numai fracțiunile de secundă zero (`.000Z` și `Z`),
care reprezintă același timestamp. Orice altă diferență produce cod de ieșire
nenul.

Rulează apoi testele folosind PostgreSQL:

```bash
../.venv/bin/python manage.py check
../.venv/bin/python manage.py test
```

`manage.py test` creează o bază de test separată; utilizatorul PostgreSQL trebuie
să aibă dreptul de a crea baze doar în mediul în care rulezi testele. Nu acorda
acest drept utilizatorului de producție numai pentru a rula testele pe server.

## Revenire temporară la SQLite

Oprește serviciul Django, setează în `.env`:

```dotenv
DB_ENGINE=sqlite
```

Apoi verifică și repornește serviciul:

```bash
../.venv/bin/python manage.py check
sudo systemctl restart gunicorn
sudo systemctl status gunicorn --no-pager
```

Variabilele `DB_NAME`–`DB_PORT` pot rămâne în `.env`; sunt ignorate când engine-ul
este SQLite. Revenirea este sigură numai înainte ca PostgreSQL să primească date
noi. După scrieri în PostgreSQL, bazele diverg și este necesar un plan separat de
sincronizare inversă înainte de rollback.

## Pașii de executat ulterior pe server

1. Fă backup extern și verifică hash-ul fișierului `db.sqlite3`.
2. Deploy-ează codul; fără `DB_ENGINE`, noua configurație continuă să folosească
   SQLite.
3. Instalează dependențele cu `../.venv/bin/python -m pip install -r requirements.txt`.
4. Provisionează PostgreSQL 14+ într-o bază goală și acordă utilizatorului
   aplicației drepturi numai asupra acelei baze. Nu reutiliza parola din exemplu.
5. Deschide o fereastră de mentenanță și oprește scrierile:

   ```bash
   sudo systemctl stop gunicorn
   mkdir -p .postgresql-migration
   chmod 700 .postgresql-migration
   cp -p db.sqlite3 ".postgresql-migration/db.sqlite3.$(date +%Y%m%d-%H%M%S).backup"
   sha256sum db.sqlite3
   ```

6. Exportă cu exact comanda din secțiunea „Export sigur din SQLite”.
7. Adaugă în `.env` cele șase variabile PostgreSQL reale și rulează:

   ```bash
   chmod 600 .env
   ../.venv/bin/python manage.py check
   ../.venv/bin/python manage.py migrate --noinput
   ../.venv/bin/python manage.py showmigrations
   ../.venv/bin/python manage.py loaddata .postgresql-migration/sqlite-data.json
   ../.venv/bin/python manage.py reset_postgresql_sequences
   ../.venv/bin/python manage.py verify_postgresql_copy --sqlite-path db.sqlite3 --test-write
   ```

8. Generează fixture-ul PostgreSQL și rulează `compare_data_fixtures` cu comenzile
   din secțiunea de verificări.
9. Rulează verificările funcționale/autentificarea și, ideal, testele complete în
   staging sau local pe aceeași versiune PostgreSQL.
10. Pornește aplicația și verifică logurile:

    ```bash
    sudo systemctl start gunicorn
    sudo systemctl status gunicorn --no-pager
    sudo journalctl -u gunicorn -n 100 --no-pager
    ```

11. Păstrează `db.sqlite3`, backup-ul și fixture-ul până după confirmarea completă
    a aplicației. Nu le publica în Git.

## Rezultatul probei locale din 2026-09-03

- Python local: 3.11.15; Django instalat: 5.2.12; PostgreSQL: 16-alpine.
- Toate migrațiile Django și `ToolApp` 0001–0081 s-au aplicat fără erori.
- 97.393 obiecte au fost exportate și importate.
- Diferența de număr a fost zero pentru fiecare model verificat.
- Fixture-urile au avut același hash semantic:
  `09cce2bc04a0e2ce9bb299bd1d9a450b87e211f546fe4d27a6ab2369073bf7cf`.
- SQLite a avut zero erori de chei străine; PostgreSQL a avut zero constrângeri
  nevalidate, zero indexuri invalide și zero erori în 53 de secvențe verificate.
- Testul temporar de creare și autentificare PIN a trecut și a fost anulat prin
  rollback.
- Suita completă: 255 teste trecute pe PostgreSQL.
- Ambele fișiere de dependențe fixează `Django==5.2.12`.
- Profilul endpointurilor de concediu (mediană după încălzire, PostgreSQL local):
  o zi a scăzut de la 12 query-uri / 4,647 ms la 8 query-uri / 4,002 ms, iar un
  interval de 21 zile lucrătoare a scăzut de la 249 query-uri / 57,230 ms la
  12 query-uri / 7,439 ms.
