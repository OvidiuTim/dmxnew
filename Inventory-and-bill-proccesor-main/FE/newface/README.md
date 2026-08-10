# Newface — portalul Angular Novarion

Frontend Angular 15 pentru dashboard, pontaj, fișe de angajat și magazie. Rulează pe aceeași origine cu backend-ul și folosește prefixul `/api`.

## Pornire și verificare

```bash
npm install
npm start
npm run build
```

Serverul de dezvoltare este disponibil implicit la `http://localhost:4200/`. Build-ul este scris în `dist/newface/`.

## Navigația portalului

Shell-ul global are o singură navigație, grupată astfel:

- General: Dashboard;
- Pontaj: Prezență zilnică, Rapoarte, Fișe angajați, Echipe și program, Concedii;
- Magazie: Privire generală, Scule, Echipamente SSM, Istoric;
- Resurse umane: Documente.

Rutele integrate de inventar sunt:

- `/magazie/scule` — folosește `GET /api/tool/?is_ssm=false`;
- `/magazie/echipamente-ssm` — folosește `GET /api/tool/?is_ssm=true`;
- `/magazie/istoric` — corelează `GET /api/history/`, `GET /api/tool/` și `GET /api/user/` pentru trasabilitate și identificarea operațiunilor SSM.

Ambele liste de inventar au indicatori, căutare, filtre, paginare și stări explicite de loading/error/empty. Istoricul afișează numai operațiunile reale `OUT`, `IN` și `ADJ`; nu inventează transferuri, service sau casări dacă backend-ul nu le oferă.

## Iconuri

Interfața folosește exclusiv familia Google `Material Symbols Rounded` pentru iconurile funcționale. Fontul este importat o singură dată în `src/styles.css`; componentele refolosesc clasa globală `material-symbols-rounded` sau componenta `app-icon`, care mapează semantic aceleași simboluri. Imaginile de profil și elementele de brand rămân resurse grafice separate.

## Modulul legacy de unelte

Rutele `/unelte`, `/unelte/adauga-unealta`, `/predare-unealta` și `/history` rămân standalone. Ele nu sunt încadrate de shell-ul global și își păstrează structura, meniul și fluxurile proprii. Butonul „Modul complet de gestiune” din listele integrate deschide `/unelte`.

## Permisiuni

Noile rute refolosesc cheile existente în backend, fără schimbarea contractului de autorizare:

- listele Scule și Echipamente SSM: `/unelte`;
- istoricul integrat: `/history`;
- Echipe și program / Concedii: `/pontaj` cât timp nu există permisiuni backend dedicate;
- Documente: `/pontaj/fisa-angajat` cât timp nu există permisiune backend dedicată.

Loginul și rutele publice `/clockinandout` și `/clockinandoutdriver` nu folosesc shell-ul global. Routerul păstrează restaurarea scroll-ului la începutul paginii.

## Starea backend-ului pentru echipe, program și concedii

- `EmployeeTeam` și `EmployeeTeamMember` modelează echipe permanente, liderul și apartenența activă. Nu există endpoint administrativ public pentru CRUD, alocare pe șantier sau ordonarea membrilor; datele echipei apar doar în dashboard-ul mobil al angajatului și se pot administra în Django Admin.
- Modelul `Worksite` și legătura echipă–șantier au fost eliminate în migrarea `0048`. Pontajul păstrează șantierul ca text pe sesiuni/evenimente.
- Programul este global și fix în backend: 07:30–17:30 în zilele lungi și 07:30–14:00 sâmbăta, cu grație de 10 minute. Nu există model sau API de program pe echipă ori angajat.
- `LeaveRequest` acoperă cereri plătite/neplătite și stările pending/approved/rejected/cancelled. API-ul mobil permite creare, listare și anularea propriei cereri în așteptare; aprobarea/respingerea se face doar în Django Admin.
- `LeaveDay` acoperă zile CO/CM/fără plată/nemotivat/alt motiv și este expus prin endpointurile administrative `leave/upsert`, `leave/get` și `leave/delete`, precum și în răspunsurile de pontaj/plată.

Din acest motiv, paginile Echipe și program, Concedii și Documente rămân stări de integrare explicite, fără date mock. Pentru finalizarea lor sunt necesare contracte API administrative și chei de permisiune dedicate în backend.
