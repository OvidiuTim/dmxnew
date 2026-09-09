# Importul meseriilor din Workers_List_teams_EN

Comanda `import_employee_trades` aplică lista din Excelul verificat la 9 septembrie 2026. Lista este inclusă în Git în `ToolApp/data/employee_trades_2026_09_09.json`; nu trebuie copiat Excelul pe server. Importul nu rulează automat la deploy sau migrate.

Sunt incluse 113 persoane: toate cele 115 poziții din foile cu angajați, cu excepția Sukhwnat Singh și Loverpreet Singh. Se copiază exact textul din coloana Role, eliminând doar spațiile de la capete. Sunt păstrate meseriile multiple și punctele inițiale din `.UNSKILLED` și `.Unskilled plumber`. Team, Review, fotografiile și statutul de angajare nu se importă. Persoanele demise rămân demise; li se actualizează numai meseria.

În baza locală, importul a modificat 56 de meserii, iar 57 erau deja identice. Verificarea ulterioară a comparat toate cele 113 valori cu Excelul și toate câmpurile angajaților cu backupul: numai cele 56 de meserii s-au schimbat. Cele două persoane excluse au rămas nemodificate.

## Identificarea angajaților

Lista fixează asocierea prin SHA-256 al valorii complete `UserSerie` din baza locală. Nu folosește ID-uri numerice locale, meseria modificată sau căutare aproximativă la rularea pe server. CNP-urile și pașapoartele nu sunt incluse în clar în manifest. Serverul trebuie să păstreze aceleași valori UserSerie; dacă un identificator lipsește, întreaga aplicare se oprește.

Numele repetate au fost asociate folosind numele, meseria anterioară și statutul din baza locală:

| Nume | Asociere |
| --- | --- |
| Amandeep | Painter rămâne Painter; JCB operator devine MEWP operator |
| Neeraj Kumar | Plumber rămâne Plumber; Drywall devine Drywaller / Painter, cu textul exact din Excel |
| Naresh Kumar | Painter și Plumber se păstrează la persoanele corespunzătoare |
| Ravinder Kumar | Electrician și Steel fixer se păstrează la persoanele corespunzătoare |
| Mandeep Singh | Painter primește rolul Painter / Helper; JCB operator primește Dumper / MEWP, cu textul exact din Excel |
| Kumar Rakesh / Rakesh Kumar | Sudorul activ rămâne Welder; zugravul demis primește rolul din Left the company |
| Parwinder Singh | Plumber activ devine Gardener; Helper demis rămâne Helper |

Comanda acceptă pentru fiecare angajat fie meseria inițială verificată, fie valoarea finală. Orice altă valoare oprește întregul import, pentru a nu suprascrie o modificare ulterioară făcută pe server. Rularea repetată după succes produce zero modificări. Persoanele care nu sunt în manifest rămân nemodificate.

## Server PostgreSQL

După publicarea acestui commit pe `origin/main`, rulează blocul de mai jos pe server. Folosește căile și baza `pontaj` din configurația existentă. `git pull --ff-only` se oprește dacă istoricul a divergit; nu șterge modificările locale prin reset sau clean.

```bash
sudo bash <<'BASH'
set -euo pipefail
umask 077

TRADE_BACKUP_DIR="/srv/pontaj/backups/trades-$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$TRADE_BACKUP_DIR"
sudo -u postgres pg_dump --format=custom --no-owner --no-privileges pontaj > "$TRADE_BACKUP_DIR/pontaj.dump"
test -s "$TRADE_BACKUP_DIR/pontaj.dump"
pg_restore --list "$TRADE_BACKUP_DIR/pontaj.dump" >/dev/null
echo "Backup PostgreSQL: $TRADE_BACKUP_DIR/pontaj.dump"

sudo -u app -H bash -lc '
set -euo pipefail
cd /srv/pontaj
git pull --ff-only origin main

cd Inventory-and-bill-proccesor-main/dataAPI
source .venv/bin/activate
python manage.py check
python manage.py import_employee_trades --require-postgresql
python manage.py import_employee_trades --require-postgresql --apply
python manage.py import_employee_trades --require-postgresql
'
BASH
```

La sfârșit trebuie să apară `Identificați: 113; de modificat: 0; deja identici: 113`. Numărul schimbărilor la prima aplicare depinde de starea serverului; dacă baza este identică cu cea locală de dinaintea importului, vor fi 56.

Această schimbare nu necesită migrare, build Angular, restart de servicii sau rularea comenzilor pentru emailuri. Reîncarcă pagina angajaților după import. Dacă pull aduce și alte schimbări, urmează separat pașii de deploy necesari acestora.

La aplicare, comanda salvează și valorile vechi/noi într-un fișier JSON privat din `dataAPI/_backups/`, apoi actualizează exclusiv `Users.trade` într-o tranzacție. Dacă verificarea finală eșuează, modificările sunt anulate. Fișierul JSON reprezintă valorile de dinaintea tranzacției și poate exista și după o încercare eșuată; verifică rezultatul comenzii înainte de a-l utiliza pentru revenire.

## Validare dezvoltare

Din `Inventory-and-bill-proccesor-main/dataAPI`:

```bash
../.venv/bin/python manage.py test ToolApp.test_trade_import_command --noinput
../.venv/bin/python manage.py import_employee_trades
```

Cele 7 teste verifică previzualizarea, identificarea omonimelor, păstrarea celorlalte câmpuri, excluderile, repetarea importului, backupul, oprirea la date divergente sau invalide, rollbackul și protecția împotriva folosirii SQLite în comenzile pentru server. Testele locale folosesc SQLite; aplicarea pe PostgreSQL rămâne etapa de server de mai sus.
