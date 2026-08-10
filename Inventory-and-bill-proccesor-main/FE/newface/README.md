# bloom-in — portalul Angular DMX Construction

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
- Pontaj: Prezență zilnică, Rapoarte, Fișe angajați;
- Echipe și program: Echipe permanente, Echipele de azi, Personal disponibil, Concedii;
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

Rutele folosesc chei backend explicite:

- listele Scule și Echipamente SSM: `/unelte`;
- istoricul integrat: `/history`;
- Echipe permanente: `/pontaj/echipe`;
- Echipele de azi: `/pontaj/echipe-azi`;
- Personal disponibil: `/pontaj/personal-disponibil`;
- Concedii: `/pontaj`;
- Documente: `/pontaj/fisa-angajat` cât timp nu există permisiune backend dedicată.

Loginul și rutele publice `/clockinandout` și `/clockinandoutdriver` nu folosesc shell-ul global. Routerul păstrează restaurarea scroll-ului la începutul paginii.

## Echipe permanente și alocări temporare

- `EmployeeTeam` și `EmployeeTeamMember` modelează echipele permanente, șeful și apartenența activă unică. `default_worksite` păstrează șantierul implicit ca text, compatibil cu sesiunile de pontaj. Modelul structurat `Worksite` rămâne eliminat din migrarea `0048`.
- `TemporaryWorkerRequest` păstrează echipa solicitantă, echipa sursă, muncitorul, perioada, motivul, autorii deciziei și statusurile `pending`, `approved`, `rejected`, `cancelled`, `expired`. Acceptarea nu modifică apartenența permanentă.
- Un angajat nu poate fi membru permanent în două echipe active, iar un șef nu poate conduce două echipe active. Solicitările suprapuse și intervalele în care angajatul are `LeaveDay` sunt respinse în backend.
- Administratorii și utilizatorii cu permisiunea `/pontaj/echipe` gestionează toate echipele. Șefii primesc automat acces la cele trei pagini și pot modifica numai membrii propriei echipe, solicita personal și soluționa cererile primite.

Endpointurile modulului sunt:

- `GET/POST /api/teams/` și `GET/PUT /api/teams/<id>/`;
- `POST /api/teams/<id>/members/`;
- `GET/POST /api/teams/requests/` și `POST /api/teams/requests/<id>/action/`;
- `GET /api/teams/today/?date=YYYY-MM-DD`;
- `GET /api/teams/available/?date=YYYY-MM-DD`.

Situația zilnică este calculată din echipele permanente, transferurile aprobate, `AttendanceSession` și `LeaveDay`. Pagina Personal disponibil folosește aceeași sursă pentru prezență, meserie, șantier și indisponibilitate.

## Program și concedii

- Programul este global și fix în backend: 07:30–17:30 în zilele lungi și 07:30–14:00 sâmbăta, cu grație de 10 minute. Nu există model sau API de program pe echipă ori angajat.
- `LeaveRequest` acoperă cereri plătite/neplătite și stările pending/approved/rejected/cancelled. API-ul mobil permite creare, listare și anularea propriei cereri în așteptare; aprobarea/respingerea se face doar în Django Admin.
- `LeaveDay` acoperă zile CO/CM/fără plată/nemotivat/alt motiv și este expus prin endpointurile administrative `leave/upsert`, `leave/get` și `leave/delete`, precum și în răspunsurile de pontaj/plată.

Paginile Concedii și Documente rămân stări de integrare explicite până la introducerea contractelor administrative dedicate; modulul de echipe este funcțional și nu folosește date mock.
