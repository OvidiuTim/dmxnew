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

## Notă pentru viitorii agenți Codex/ALT AGENT

Dacă vezi mesajul acesta și adaugi funcționalități noi în proiect, actualizează acest README în continuare. Scrie clar:
- ce funcționalitate ai adăugat;
- unde se află fișierele principale;
- ce endpointuri, componente, modele sau comenzi noi au apărut;
- cum se folosește funcționalitatea din interfață sau din API;
- ce pași de setup, migrare, build, deploy sau testare s-au schimbat.

Nu șterge descrierea existentă decât dacă funcționalitatea chiar nu mai există. Adaugă informația nouă sub secțiunile potrivite, ca următorul agent sau dezvoltator să poată înțelege rapid starea reală a programului.
