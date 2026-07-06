# Import unelte din Excel

Comanda `import_tools_xlsx` citește foaia `Inventar extras` și importă uneltele în
modelul `Tools`. Importul folosește coloana `ID intern` drept `ToolSerie`, așadar
poate fi reluat fără să creeze duplicate.

## Prima rulare pe server

Din directorul `Inventory-and-bill-proccesor-main/dataAPI`, cu mediul virtual
activat:

```bash
pip install -r requirements.txt
cp db.sqlite3 db.sqlite3.backup-before-tool-import
python manage.py migrate
python manage.py import_tools_xlsx "/cale/catre/Inventar scule(1).xlsx" --dry-run
python manage.py import_tools_xlsx "/cale/catre/Inventar scule(1).xlsx"
```

Înainte de import este recomandată o copie de siguranță a bazei `db.sqlite3`.
Rularea cu `--dry-run` validează întregul fișier și nu scrie nimic în baza de
date. Importul real este atomic: dacă apare o eroare, nu rămâne un import
parțial.

Fișierul Excel nu trebuie adăugat în Git. Poate fi copiat pe server prin SCP,
SFTP sau panoul furnizorului de hosting, apoi se transmite calea lui comenzii.

## Rulări ulterioare

Implicit, uneltele care au deja același `ToolSerie` sunt omise. Pentru a
suprascrie câmpurile importate cu valorile actuale din Excel:

```bash
python manage.py import_tools_xlsx "/cale/catre/Inventar scule(1).xlsx" --update-existing
```

Folosește `--update-existing` numai intenționat: poate înlocui modificările
făcute ulterior în aplicație pentru uneltele respective.

Pentru un fișier cu alt nume de foaie:

```bash
python manage.py import_tools_xlsx "/cale/catre/inventar.xlsx" --sheet "Numele foii"
```
