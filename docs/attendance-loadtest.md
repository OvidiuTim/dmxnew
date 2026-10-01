# Test de depontare concurentă, cu date fictive

`scripts/attendance-loadtest.py` pornește propriul Gunicorn pe un port aleatoriu
legat exclusiv de 127.0.0.1. Nu acceptă URL public, PIN-uri reale sau o bază
existentă cu tabele. Nu citește `.env`; folosește secret, media și cache separate.
PostgreSQL trebuie să aibă un rol dedicat, cu același nume ca baza temporară.

Scenariul creează 200 de angajați fictivi, 14 zile de istoric pentru fiecare și
19 absenți fictivi, fără numele persoanelor reale. La fiecare nivel 25/50/100/200
se pornesc simultan clienții HTTP pentru fiecare dintre etapele:

- login prin PIN;
- verificare legacy (401 așteptat, ca în Angular), apoi verificare cont;
- încărcare dashboard;
- depontare, apoi pontare cu dovadă JPEG sintetică și GPS de test.

Patru monitoare și o cerere health periodică rulează în fundal. Scenariul verifică
starea și numărul sesiunilor/evenimentelor pentru fiecare persoană în baza de
test; absenții trebuie să rămână fără sesiuni. La primul răspuns incorect sau
timeout oprește creșterea concurenței. Nu reîncearcă POST-urile.

## Pe server de test Ubuntu/PostgreSQL

Copiază ambele scripturi într-un director accesibil utilizatorului `app`, de
exemplu `/srv/pontaj/scripts/`, apoi:

```bash
sudo bash /srv/pontaj/scripts/run-attendance-loadtest.sh
```

Necesită aplicația instalată în directorul uzual și PostgreSQL local pe 5432,
acces administrativ peer pentru utilizatorul OS `postgres`, plus Gunicorn în
venv. `APP_DIR` și `APP_USER` pot fi configurate explicit pentru alt server.
Nu instalează pachete, nu oprește serviciile existente și nu rulează deploy.

Pentru serverul actual de 1 GB, într-o fereastră acceptată de indisponibilitate,
poți folosi `--pause-live-backend`. Oprește temporar doar `pontaj.service`, ca
instanța de test să nu concureze cu încă un Gunicorn pentru memorie. Site-ul nu
va putea efectua login/pontaj în acest interval. La ieșire, inclusiv eșec sau
timeout, repornește serviciul dacă fusese activ și verifică health-ul public.
Nu oprește Nginx, PostgreSQL, cron sau timerele de întreținere.
În cazul SIGKILL/căderii sistemului, restaurarea din trap nu poate rula;
comanda de recuperare este `sudo systemctl start pontaj`.
`vmstat.log` din directorul raportului înregistrează CPU, memorie și swap.

Wrapperul creează un rol fără drepturi administrative și o bază nouă cu nume
aleatoriu, rulează migrarea/scenariul ca `app`, apoi șterge numai această bază și
acest rol. Raportul JSON rămâne în directorul afișat din `/var/tmp/`. În caz de
eșec rămâne și logul backendului de test, care conține numai pontaje fictive.
Nu șterge automat raportul. Dacă sistemul omoară wrapperul cu SIGKILL sau cade
serverul, curățarea automată nu poate fi garantată; inspectează resursele cu
prefixul `pontaj_loadtest_` înainte de a le elimina manual.

Procesul suplimentar consumă CPU/RAM: preferă un server de test cu resurse și
versiuni comparabile. Wrapperul refuză pornirea sub 300 MiB RAM disponibili;
testul oprește instanța sa dacă memoria disponibilă scade sub 100 MiB. Acestea
sunt praguri conservative, nu o garanție că producția nu poate fi încetinită.
Testul are o limită totală de 10 minute. Nu îl porni lângă vârful real de pontaj.

## Verificare locală a scenariului

```bash
Inventory-and-bill-proccesor-main/.venv/bin/python scripts/attendance-loadtest.py \
  --app-dir Inventory-and-bill-proccesor-main/dataAPI \
  --sqlite-smoke --output /tmp/pontaj-smoke-report.json
```

Modul SQLite folosește un singur fir de cereri pentru a evita confundarea
blocărilor SQLite cu PostgreSQL; nu este o măsurătoare a capacității producției.
PostgreSQL folosește configurația comunicată pentru producție: un worker
Gunicorn gthread, 16 fire, timeout 120 s și keep-alive 5 s.

`passed` confirmă răspunsurile și integritatea datelor. Verifică separat
`all_phase_p95_below_2s`, percentilele și duratele maxime pentru fiecare etapă.
Rezultatul depinde de procesor, RAM, istoric, roluri și versiuni. Nu include
randarea Angular, TLS/Nginx, rețeaua telefoanelor sau rularea simultană a jobului
de închidere automată la 17:30. Un rezultat bun nu dovedește singur cauza
incidentului și nu garantează absența blocajelor în toate aceste condiții.
