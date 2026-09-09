# Inventory-and-bill-processor (Django backend)

Backend-ul e în `dataAPI/`. Există și `FE/` pentru frontend (opțional). **Nu folosi** `myenv/` din repo; creează-ți un mediu virtual curat (`.venv`).

## Cerințe
- Python 3.11 sau 3.12 recomandat (merge și 3.13, dar unele pachete pot întârzia compatibilitatea)
- pip actualizat

## Setup rapid — Windows (PowerShell)
```powershell
# 1) Intră în directorul proiectului (înlocuiește cu calea ta)
cd D:\Github\dmxnew\Inventory-and-bill-proccesor-main

# 2) Creează un mediu virtual NOU (NU folosi myenv/)
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1

# 3) Instalează dependențele backend-ului
python -m pip install --upgrade pip
pip install -r dataAPI\requirements.txt

# 4) Migrații & rulare
cd dataAPI
python manage.py migrate
python manage.py createsuperuser   # opțional
#admin admin
python manage.py runserver
# Deschide http://127.0.0.1:8000/
```

## Unde este programul principal

Programul principal se află în `Inventory-and-bill-proccesor-main/`.

Structura importantă este:
- `Inventory-and-bill-proccesor-main/dataAPI/` - backend Django / Django REST, baza de date, modelele, endpointurile API și comenzile de administrare.
- `Inventory-and-bill-proccesor-main/FE/newface/` - frontend Angular folosit pentru interfața de magazie, pontaj, rapoarte și fișe angajați.
- `Inventory-and-bill-proccesor-main/dataAPI/media/model_xcel_pontaj.xlsx` - șablonul Excel folosit la generarea pontajului lunar.
- `Inventory-and-bill-proccesor-main/fisa_angajat-main/` - variantă statică mai veche pentru fișa angajatului.
- `Inventory-and-bill-proccesor-main/SECURITY_CHANGES.md` - notițe despre securitate, deploy, login, protejarea endpointurilor și schimbările legate de PIN/pontaj.

## Șantierele principale pentru pontaj GPS

Sursa backend unică este `Inventory-and-bill-proccesor-main/dataAPI/ToolApp/worksites.py`. Aceeași configurație este expusă prin API către Team Dashboard și este păstrată sincronizat în fallbackul paginii publice `/clockinandout`.

| Șantier | Latitudine | Longitudine |
| --- | ---: | ---: |
| The Lake Home Bloc A | 45.81034964338528 | 24.130413480467038 |
| The Lake Home Bloc B2 | 45.81034964338528 | 24.130413480467038 |
| The Lake Home Bloc E & F | 45.81034964338528 | 24.130413480467038 |
| Birou ingineri & TESA | 45.809820427020156 | 24.13019018453687 |
| Psihiatrie C8 | 45.80720228440877 | 24.15440514734915 |
| Psihiatrie C16 | 45.80768553302182 | 24.157085884823974 |
| Spital Victoria | 45.725861888407216 | 24.70584969156609 |
| Casa de Cultură Victoria | 45.73050790281027 | 24.70109770865094 |
| Bazin Ucea | 45.70058115535115 | 24.689376326811146 |
| Bloc Agnita | 45.97724541353617 | 24.62272565333796 |
| Grădinița Agnita | 45.97789754940184 | 24.61674765866955 |
| Bloc 14 Victoria | 45.73336901742498 | 24.701707107591304 |
| Bloc 3 Victoria | 45.73105012404724 | 24.696154238062714 |
| Cisnadie | 45.71648035800439 | 24.162636701234426 |
| The River chalet | 45.76837384893173 | 23.916721618503065 |

Denumirile istorice „Birou ingineri” și „Sibiel - the river chalet” rămân aliasuri acceptate și sunt normalizate automat la denumirile de mai sus. Razele de pontaj sunt configurate separat în aceeași sursă backend.

## Ce face programul acum

Aplicația este un sistem intern pentru DMX/Novarion care combină gestiunea magaziei cu pontajul angajaților.

### Backend Django

Backend-ul oferă API-uri pentru:
- angajați/utilizatori: creare, listare, editare, ștergere, import bulk, actualizare bulk și ștergere bulk;
- date de angajat: nume, serie, firmă, meserie, telefon, poză, mărime echipament, echipament primit, tarif orar, PIN și UID/NFC;
- autentificare admin prin `/api/auth/login/` și verificare prin `/api/auth/verify/`, cu cookie HttpOnly;
- protejarea endpointurilor administrative prin middleware, cu excepții pentru login, verificare, scanare NFC și pontajul public cu PIN;
- logarea încercărilor de PIN și blocarea temporară după prea multe încercări greșite;
- unelte: CRUD, serie unică, status `in_lucru`, `magazie`, `stricata`, locație, furnizor, detalii, număr de bucăți, RFID, marcare SSM, alocare către angajat, returnare și pierdere;
- istoric unelte: înregistrări de predare, returnare și ajustare, cu angajat, unealtă, operator, dată/oră, direcție și cantitate;
- materiale și consumabile: CRUD pentru stocuri, cantități, valori, furnizori, unități de măsură și consumuri către/de la angajați;
- magazie/schele: CRUD pentru cofraje metalice, cofraje tip Doka, popi, schelă ușoară, schelă de fațadă, schelă modulară, mijloace fixe, combustibil și istoric mișcări schele;
- NFC/RFID: endpointuri pentru verificarea cititorului, scanări NFC, intrări/ieșiri RFID și legare taguri;
- pontaj: check-in/check-out prin PIN, NFC sau mod manual, sesiuni de lucru, evenimente de prezență, șantier, GPS, durată lucrată și sursă;
- pontaj șoferi: mod separat în care GPS-ul este obligatoriu;
- pontaj cu restricție de dispozitiv: check-out-ul manual trebuie făcut de pe același telefon/browser care a făcut check-in-ul;
- pontaj cu locație: salvare coordonate GPS la intrare și ieșire, inclusiv acuratețe și momentul capturării;
- rapoarte pontaj: zi curentă, zi selectată, prezenți acum, interval de date, cost pe zi și raport pe șantiere;
- editare manuală pontaj: înlocuire sesiuni pe zi, modificare sesiune, ștergere sesiune și ștergere pontaj pe zi;
- concedii/absențe: creare, citire și ștergere `LeaveDay`, cu motive precum CO, CM și ALT, ore, multiplicator și sumă de plată;
- calcul plată: plată pe zi și pe lună pe baza orelor lucrate și a tarifului orar;
- generare Excel lunar de pontaj, opțional filtrat pe firmă, folosind șablonul din `dataAPI/media/model_xcel_pontaj.xlsx`;
- pagini server-side pentru monitor pontaj normal și variantă albă, plus stream SSE pentru evenimente live;
- comenzi de administrare pentru închiderea sesiunilor deschise la 17:30, asignarea PIN-urilor din TSV/CSV și trimiterea raportului zilnic cu angajații fără pontaj.
- import one-shot, tranzacțional și idempotent pentru datele „Ajutor bilet acasă” din `ToolApp/data/bonus_avion_excel_general.xlsx`; migrarea `ToolApp.0082` rulează automat la următorul `python manage.py migrate`, nu la pornirea Gunicorn. Importul procesează independent data angajării, activarea beneficiului și istoricul ultimei plecări, astfel încât o celulă goală sau invalidă nu blochează celelalte câmpuri valide, și nu creează angajați. Comanda `python manage.py import_home_ticket_benefits` repetă verificarea în mod dry-run, iar `--apply` este disponibil doar pentru o reluare manuală explicită.

### Frontend Angular

Frontend-ul din `FE/newface` oferă:
- login pentru zona protejată de pontaj/administrare;
- rută principală către pontaj;
- dashboard cu istoric de mișcări pentru unelte, normalizat și paginat;
- meniu de magazie cu acces către angajați, materiale, unelte, schele și istoric;
- pagină de angajați cu listare și acces la fișa angajatului;
- formular de creare/editare angajat, inclusiv date personale, firmă, meserie, tarif orar, PIN și poză;
- fișă angajat cu datele angajatului, pontaj, plată și uneltele alocate;
- gestiune unelte: listare, căutare, filtre pe categorie SSM/șantier și status, total bucăți, editare, ștergere și actualizare date;
- adăugare unealtă: serie, nume, SSM, angajat alocat, bucăți și detalii; statusul și locația se calculează în funcție de alocare;
- predare/preluare unealtă: selectare angajat, căutare unelte disponibile sau alocate, predare către angajat și returnare în magazie ori ca stricată;
- materiale și consumabile: interfață pentru stocuri și mișcări de materiale;
- schele/cofraje/popi/mijloace fixe/combustibil: interfață de gestiune și istoric mișcări;
- pontaj administrativ: vizualizare zi, prezenți, intervale, sesiuni și angajați;
- rapoarte pontaj: rapoarte pe interval, pe șantiere, costuri și exporturi;
- pontaj manual public (`/clockinandout`): alegere limbă, alegere șantier, introducere PIN, hartă Leaflet, validare poziție GPS în perimetrul șantierului și check-in/check-out;
- limbi pentru pontaj manual: română, engleză, punjabi, hindi și nepaleză;
- pontaj șoferi (`/clockinandoutdriver`): introducere PIN cu GPS obligatoriu, fără limitare la perimetrul unui șantier, dar cu poziția salvată;
- rute protejate cu `AuthGuard` pentru pontaj, rapoarte, fișă angajat și formularele de angajat;
- folosire `window.location.origin + /api`, deci frontend-ul este gândit să ruleze pe aceeași origine cu backend-ul în deploy.
- shell global cu navigație restrânsă la Dashboard, Pontaj, Magazie și Resurse umane, plus iconografie SVG reutilizabilă;
- liste integrate și separate pentru Scule (`/magazie/scule`) și Echipamente SSM (`/magazie/echipamente-ssm`), filtrate de backend prin `is_ssm`;
- istoric integrat de magazie la `/magazie/istoric`, construit numai din endpointurile reale de istoric, unelte și utilizatori;
- modul legacy de unelte păstrat standalone pe `/unelte`, `/unelte/adauga-unealta`, `/predare-unealta` și `/history`, în afara shell-ului global;
- documentația tehnică detaliată a rutelor, permisiunilor și limitărilor backend pentru echipe/program/concedii se află în `Inventory-and-bill-proccesor-main/FE/newface/README.md`.

### Login cu PIN și performanță Team Management

- Ecranul `/login` deschide implicit autentificarea angajaților numai cu PIN-ul existent din fișa angajatului; după login se deschide `/team-dashboard`. Fila „Administrator” folosește parola generală configurată deja prin `PONTAJ_PASSWORD` și deschide `/dashboard`.
- `POST /api/app-auth/login/` acceptă `{ "pin": "0123" }`; clienții existenți cu `username` și `pin` rămân compatibili. Loginul fără username refuză PIN-urile comune mai multor angajați activi și conturile inactive, păstrează zerourile inițiale și limitează încercările greșite. PIN-urile trebuie să identifice un singur angajat activ. Un cont lipsă se creează la prima autentificare validă.
- În `team-portal.component.ts/html`, grupurile de personal sunt păstrate între actualizările interfeței și urmărite după ID-ul echipei, pentru ca deschiderea acordeoanelor și selectarea echipei destinație să nu recreeze continuu formularele. Paginile de detaliu încarcă propriile date fără să aștepte dashboardul; reîncărcările duplicate de la intrare sunt eliminate, iar cererile de încărcare sunt anulate la ieșire.
- În `ToolApp/team_portal_views.py`, marcajele de absență sunt încărcate împreună pentru membrii echipelor și personal; numărul de interogări nu mai crește pentru fiecare angajat absent. Dashboardul citește doar identitatea echipelor și încarcă împreună relațiile cererilor de transfer.
- Nu sunt necesare migrații noi. Pentru publicare sunt necesare buildul Angular (`npm run build`) și actualizarea/restartarea backendului. Testele specifice sunt `ToolApp.test_portal_login_performance`, `login.component.spec.ts` și `team-portal.component.spec.ts`; acesta din urmă deschide un acordeon cu 250 de angajați în Chrome Headless.

### Modele principale din baza de date

Backend-ul folosește modele pentru:
- `Users` - angajați/utilizatori, PIN, UID, firmă, tarif orar și date de profil;
- `Tools` - unelte, status, locație, RFID, SSM și alocare către angajat;
- `Histories` - istoric predare/returnare/ajustare unelte;
- `Materials` și `Consumables` - materiale, stocuri și consumuri;
- `Shed`, `WorkField`, `Unfunctional` - evidențe legacy pentru magazie, șantier și unelte nefuncționale;
- `CofrajMetalics`, `CofrajtTipDokas`, `Popis`, `SchelaUsoaras`, `SchelaFatadas`, `SchelaFatadaModularas`, `MijloaceFixes`, `Combustibils`, `HistorieScheles` - module pentru schele, cofraje, popi, mijloace fixe, combustibil și istoricul lor;
- `PresenceEvent`, `AttendanceSession`, `DailyPay`, `LeaveDay` - pontaj, sesiuni de lucru, plată și concedii/absențe;
- `PinAttemptLog` - audit pentru încercări de pontaj/autentificare cu PIN.

### Acces automat la echipe și notificări 07:40

- fiecare angajat activ are un singur `AppUser`, sincronizat prin semnal și prin comanda idempotentă `python manage.py sync_app_users`;
- șefii de echipă și supervisorii primesc dinamic acces la întregul modul „Echipe și program”, fără a pierde permisiunile acordate manual când rolul este eliminat;
- comanda `python manage.py send_team_attendance_alerts` creează o alertă grupată pe echipă pentru angajații fără check-in la 07:40, cu email și push Firebase;
- API-urile mobile expun rolurile, permisiunile efective, echipele coordonate, notificările, starea citit/necitit și înregistrarea tokenului Android;
- instrucțiunile complete de configurare și deploy sunt în `Inventory-and-bill-proccesor-main/DEPLOY_TEAM_ACCESS_NOTIFICATIONS.md`.

## Notă pentru viitorii agenți Codex/ALT AGENT

Dacă vezi mesajul acesta și adaugi funcționalități noi în proiect, actualizează acest README în continuare. Scrie clar:
- ce funcționalitate ai adăugat;
- unde se află fișierele principale;
- ce endpointuri, componente, modele sau comenzi noi au apărut;
- cum se folosește funcționalitatea din interfață sau din API;
- ce pași de setup, migrare, build, deploy sau testare s-au schimbat.

Nu șterge descrierea existentă decât dacă funcționalitatea chiar nu mai există. Adaugă informația nouă sub secțiunile potrivite, ca următorul agent sau dezvoltator să poată înțelege rapid starea reală a programului.

## Șantiere ca centre de cost

Modulul **Șantiere**, între **Pontaj** și **Echipe și program**, se deschide la `/santiere`; fiecare fișă are ruta `/santiere/:id`. Este separat de punctele GPS, pentru a păstra compatibilitatea pontajului public și a aplicațiilor Android.

### Utilizare

- **Importă punctele principale** creează câte un centru de cost pentru cele 15 puncte GPS principale încă neasociate, cu denumirile și coordonatele existente. Repetarea importului nu dublează centrele sau pontajele.
- **Șantier nou** permite alegerea unuia sau mai multor puncte existente. Primul punct completează denumirea și coordonatele, iar previzualizarea arată orele și costul din întregul istoric. Un punct poate aparține unui singur centru de cost; punctele deja folosite arată șantierul proprietar.
- Asocierea este valabilă pentru **întregul istoric și viitor**. Nu copiază și nu modifică sesiunile de pontaj. Schimbarea asocierii realocă întregul istoric; nu există încă împărțire pe intervale de valabilitate. Datele planificate ale șantierului sunt informative.
- Fișa include cod unic, beneficiar, responsabil, adresă, coordonate, date planificate, note, buget în RON fără TVA și status: planificat, activ, suspendat, finalizat, arhivat. Coordonatele fișei nu modifică perimetrele GPS de pontaj.
- Centralizatorul are filtre de perioadă, căutare, status, costuri pe șantier, ore și costuri pe angajat, plus pontaje nealocate. **Tot istoricul** elimină ambele limite de dată. Bugetul disponibil se calculează întotdeauna față de costurile cumulative, indiferent de perioada raportului.
- Registrul de cheltuieli acceptă materiale, utilaje/închirieri, transport, subcontractori, cazare, cheltuieli indirecte și alte costuri, cu dată, sumă RON fără TVA, furnizor, document și note. Corecturile se fac prin anulare cu motiv și o înregistrare nouă. Cheltuielile anulate rămân vizibile, dar sunt excluse din totaluri.
- Arhivarea păstrează toate costurile și legăturile istorice și blochează cheltuielile noi până la reactivare. Nu oprește pontajul GPS și nu ascunde pontajele viitoare. Nu există ștergere definitivă prin modul.
- Exportul CSV include centralizarea vizibilă și manopera nealocată, angajații filtrați din fișă sau întregul registru de cheltuieli din perioada selectată (inclusiv paginile neafișate și înregistrările anulate, marcate explicit). Exporturile includ BOM UTF-8 și protecție împotriva formulelor din câmpurile text.

### Calculul costurilor și limitele acoperirii

Manopera este calculată din `AttendanceSession.duration_seconds` pentru sesiunile închise, la `DailyPay.hourly_rate_snapshot` pentru angajat/zi. Dacă snapshotul lipsește, se folosește tariful curent și se marchează numărul de ore estimate. Tariful zero/lipsă este semnalat separat. Sesiunile deschise se numără, dar nu generează cost până la închidere. Rotunjirea cumulativă pe angajat/zi păstrează totalul în bani când orele sunt împărțite între puncte. Aliasurile istorice sunt rezolvate prin `worksites.match_worksite`.

Raportul citește pontajele și snapshoturile existente, fără recalcularea sau rescrierea lor. Corectarea pontajului sau a snapshotului în modulul existent se reflectă în raport; acesta nu este un registru contabil închis/înghețat. Costurile calculate nu includ automat concedii, bonusuri, beneficii, taxe salariale, facturi sau consumuri de magazie. Costurile suplimentare trebuie înregistrate explicit în registrul șantierului. Aceste integrări și alocările cu valabilitate pe perioade sunt extensii viitoare, nu funcționalități deja automate.

### Structură tehnică și acces

- Modele în `dataAPI/ToolApp/models.py`: `ConstructionSite`, `SiteAttendancePoint`, `SiteExpense`, `SiteAuditLog`; migrarea `0084_construction_site_cost_centres` adaugă tabelele, constrângerile, indexul șantier/dată pentru cheltuieli și modulul `construction_sites`.
- `site_costs.py`: raport agregat pe angajat/zi/punct, citirea tarifului salvat prin subquery indexat; numărul interogărilor nu crește cu numărul de angajați sau șantiere. Totalurile istorice necesită în continuare agregarea întregului istoric; pentru volume foarte mari poate fi adăugată o proiecție materializată.
- `site_views.py` și `site_serializers.py`: validare, tranzacții, exclusivitatea punctelor, audit, protecție la modificări concurente prin `version` și idempotenta cheltuielilor prin UUID `request_id`.
- Frontend: `FE/newface/src/app/construction-sites/`, componentă standalone încărcată separat la accesarea modulului; formulare cu dialog nativ, paginare la 50 pentru cheltuieli și audit, interfață adaptată pentru telefon.
- Administratorul are acces complet. Utilizatorii aplicației au nevoie de modulul **Șantiere** (`construction_sites`) pentru citire; pentru scriere au nevoie suplimentar de permisiunea granulară `/santiere`. Ambele se gestionează prin mecanismul existent din pagina de administrare. Accesul la Pontaj sau Echipe nu acordă automat acces la aceste costuri.

Endpointuri (toate sub `/api/construction-sites/`):

| Metodă | Rută relativă | Funcție |
| --- | --- | --- |
| GET | rădăcina | Centre, raport, puncte disponibile; `start`, `end` opționale |
| POST | rădăcina | Creare șantier; `points` conține denumirile punctelor existente |
| PATCH | `<site_id>/` | Actualizare șantier; `version` curentă obligatorie |
| POST | `import/` | Import idempotent al celor 15 puncte principale neasociate |
| GET / POST | `<site_id>/expenses/` | Listare / înregistrare cheltuieli; POST cere `request_id` UUID |
| GET | `<site_id>/expenses/?format=csv` | Export complet pentru `start` / `end`, fără limitarea paginării |
| POST | `<site_id>/expenses/<expense_id>/cancel/` | Anulare cu `reason` obligatoriu |
| GET | `<site_id>/audit/` | Istoric paginat, cu valorile înainte/după și autor |

### Instalare și verificare

1. Backend: în `Inventory-and-bill-proccesor-main/dataAPI`, rulează `../.venv/bin/python manage.py migrate` și repornește serviciul backend la publicare.
2. Frontend: în `Inventory-and-bill-proccesor-main/FE/newface`, rulează `npm run build` și publică buildul prin fluxul existent.
3. Pe o bază nouă, folosește **Importă punctele principale** sau **Șantier nou**. Migrarea creează schema, fără a face import de date pe server în mod implicit. Cele 15 centre au fost inițializate în baza locală de dezvoltare; backupul anterior migrării este în directorul local ignorat `_backups/`.
4. Backend: `../.venv/bin/python manage.py test ToolApp.test_construction_sites ToolApp.test_module_access_api ToolApp.test_worksite_standardization --noinput`.
5. Frontend: `npm test -- --watch=false --browsers=ChromeHeadless --include='src/app/construction-sites/*.spec.ts' --include='src/app/navbar/navbar.component.spec.ts' --include='src/app/auth/module-routes.spec.ts' --include='src/app/auth/auth.guard.spec.ts'` (setează `CHROME_BIN` dacă Chrome nu este detectat automat).

Testele acoperă atribuirea istorică, aliasuri, tarife salvate/estimate/zero, sesiuni deschise, rotunjire, buget cumulativ, conflicte, import repetat, autorizare, anulare, export complet și număr constant de interogări. Verificarea manuală în browser s-a făcut pe o copie izolată a bazei locale pentru creare, import de ore, cheltuieli, anulare, audit și aspect pe telefon.

Rezultat verificare locală: build Angular reușit și 36 teste backend reușite. Cele 27 de teste frontend raportează succes, însă procesul Karma/Chrome Headless 152 se încheie cu mesajul `Some of your tests did a full page reload!`; problema se reproduce și la rularea separată a testelor existente de navbar. Prin urmare, comanda frontend nu are încă un exit code curat în acest mediu, deși aserțiunile trec și fluxurile principale au fost verificate în browser. Buildul păstrează avertismentele existente de dimensiune bundle și dependențe CommonJS.
