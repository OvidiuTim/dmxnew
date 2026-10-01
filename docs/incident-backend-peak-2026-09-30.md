# Blocarea backendului la depontare

## Ce este confirmat în cod

- `pontaj_stream` ținea un worker WSGI într-un generator infinit, inclusiv când nu
  existau evenimente. Câteva monitoare puteau ocupa toate procesele sincrone.
  Brokerul era local procesului, deci nici nu transmitea fiabil între workeri.
- Deschiderea portalului putea executa scanarea întregii companii și trimiteri
  email/push înainte de răspuns. Limitarea de 60 s era în cache local procesului,
  nu un lock global, și expira chiar dacă operația precedentă încă rula.
  Cache-ul implicit este separat per proces, conform
  [documentației Django](https://docs.djangoproject.com/en/5.2/topics/cache/#local-memory-caching).
- Middleware-ul de retenție putea executa ștergeri istorice în orice cerere,
  inclusiv login.
- Închiderea automată lua lock pe toate sesiunile zilei într-o singură tranzacție,
  până la finalul procesării întregului lot.

Acestea sunt mecanisme reale de blocare, dar atribuirea incidentului de la 17:30
necesită logurile și configurația efectivă a serverului. Nu s-a accesat și nu s-a
modificat producția în această intervenție locală.

## Modificări

Monitorul primește un răspuns finit la fiecare 5 secunde, cu date confirmate în
baza de date; taburile deja deschise păstrează evenimentele enter/exit.
Interogările citesc cel mult 24 intrări și 24 ieșiri, fără fotografii.
Întreținerea rulează separat prin timer systemd, cu lock între execuții.
Retenția rulează noaptea. Închiderea automată face commit per angajat și folosește
aceeași ordine a lockurilor ca depontarea manuală: angajat, apoi sesiuni.
Deploy-ul verifică Django și baza prin `/api/health/`, nu doar HTML-ul Angular.

## Verificări locale

- Suita backend: 434 teste trecute înainte de adăugarea testului HTTP de mai jos.
- Test HTTP suplimentar: 12 cereri (6 monitoare, 4 depontări, 2 login), cu 6
  clienți concurenți și un singur worker WSGI; toate returnează 200, cele 4 sesiuni
  sunt închise, fără sesiuni noi accidentale.
- Teste pentru commit per angajat, reexecutare idempotentă, alerte recuperate de
  procesul separat, excluderea întreținerii din HTTP, replay monitor și health.
- Testele folosesc SQLite separat. Nu reprezintă măsurători de capacitate pentru
  serverul real și nu verifică blocajele PostgreSQL în producție.

## Publicare și verificare în producție

Publică schimbările împreună, folosind `deploy.sh`; instalarea timerelor este
necesară pentru a păstra alertele automate. Vezi
`Inventory-and-bill-proccesor-main/DEPLOY_TEAM_ACCESS_NOTIFICATIONS.md`.
Nu este necesară o migrație nouă și nu se schimbă regulile de calcul al orelor.

Pentru incident, verifică pe server intervalul real și fusul din jurnal:

```bash
systemctl show pontaj -p ActiveState -p SubState -p NRestarts -p TasksCurrent -p MemoryCurrent
journalctl -u pontaj --since '2026-09-30 16:45:00' --until '2026-09-30 17:45:00' --no-pager \
  | grep -E 'WORKER TIMEOUT|Using worker|Booting worker|deadlock|OperationalError|out of memory|Killed'
journalctl -k --since '2026-09-30 16:45:00' --until '2026-09-30 17:45:00' --no-pager \
  | grep -Ei 'out of memory|oom|killed process'
```

Nu trimite logurile complete ale scanărilor: codul existent scrie PIN-uri și nume
în aceste loguri. Sunt necesare mesajele de eroare, timpii și configurația
workerilor, fără parole sau datele angajaților.

## Testele din 1 octombrie și costul autentificării

Utilizatorul a rulat `run-attendance-loadtest.sh --pause-live-backend` pe server,
cu baza PostgreSQL temporară, 200 de conturi fictive și un worker gthread cu
16 fire. Backendul live a fost oprit pe durata fiecărui test și restaurat la
final (health 200). Comparația comunicată după resize:

| Măsurătoare | 1 vCPU / 1 GB | 2 vCPU / 2 GB |
| --- | ---: | ---: |
| 100 clienți, login p95 | 10,333 s | 10,061 s |
| 100 clienți, depontare p95 | 11,711 s | 6,699 s |
| 100 clienți, pontare p95 | 13,694 s | 6,190 s |
| 200 clienți, login nereușit | 136/200 | 72/200 |

La 200 testul s-a oprit la login, înainte de depontare. Erorile sunt raportate
generic drept `connection-error`, în jurul timeoutului de 15 s al clientului;
nu sunt coduri HTTP 500 și nu demonstrează singure o cădere a procesului.
Upgrade-ul a îmbunătățit unele rezultate, dar nu a eliminat problema. Fără
profilare CPU/DB și datele vmstat nu atribuim întregul incident hardware-ului.

Profilarea SQL locală a identificat recalculări repetate ale rolurilor,
modulelor și permisiunilor în același răspuns de autentificare. Scenariul de
regresie pentru login făcea 47 de interogări, iar verify cu route și module_code
făcea 59. Reutilizarea valorilor proaspăt citite în cadrul aceluiași răspuns le
reduce la 10, respectiv 15. Nu există cache persistent al permisiunilor.
Testele verifică și retragerea accesului la următoarea cerere.
După corecție, întreaga suită backend a trecut: 437 de teste, pe SQLite izolat,
inclusiv testul HTTP cu clienți concurenți.

Această reducere este măsurată local; nu reprezintă încă un rezultat de
concurență pe server după corecție. Nu au fost modificate configurația
Gunicorn, timeoutul testului sau regulile de pontaj pentru a obține reducerea.

## Retest după optimizarea autentificării

Raportul comunicat de utilizator din `pontaj-loadtest.SMSkDv7v`, după deploy
`4bb051f3`, păstrează 2 vCPU / 2 GB și un worker cu 16 fire:

| Măsurătoare | Înainte de corecție | După corecție |
| --- | ---: | ---: |
| 100 clienți, login p95 | 10,061 s | 2,955 s |
| 100 clienți, verify p95 | 9,685 s | 3,401 s |
| 200 clienți, login nereușit | 72/200 | 0/200 |

La 200 clienți, login p95 este 7,034 s și verify p95 8,261 s, fără erori.
Testul ajunge acum la dashboard: 138 răspunsuri 200 și 62 connection-error,
cu p95 15,087 s. Depontarea la 200 nu a fost încă executată cu succes.

`vmstat.log` arată cel puțin aproximativ 690 MiB RAM liberă, swap ocupat
stabil la aproximativ 1 MiB și aproape fără transferuri swap. `st` ajunge la
22%, indicând intervale de așteptare a CPU-ului gazdei. Aceste date nu arată
presiune de RAM; CPU dedicat poate îmbunătăți predictibilitatea, fără a garanta
rezolvarea latențelor. Generatorul de trafic și baza rulează pe aceeași mașină,
deci CPU-ul agregat nu poate fi atribuit exclusiv backendului. Discul raportat
este acum 58 GiB: un plan cu disc de 25 GB nu este eligibil pentru resize direct.

Corecția următoare reutilizează rolurile deja citite pentru contoarele
dashboardului, evită verificări complete de acces pentru două module cu reguli
simple și citește doar ora sesiunii deschise, fără fotografia stocată. Scenariul
SQL local de dashboard scade de la 39 la 16 interogări; verify scade de la 15
la 9. Cele 439 teste backend și cele 3 teste ale scriptului au trecut local.
Nu se păstrează cache de permisiuni între cereri.

Scriptul permite acum comparația 1 worker × 16 fire cu 2 workeri × 8 fire,
fără schimbarea serviciului live, a timeoutului sau a plafonului total de fire.
Testele scriptului verifică transmiterea opțiunilor și restaurarea serviciului;
capacitatea PostgreSQL cu două procese trebuie măsurată pe server. Vezi
`docs/attendance-loadtest.md` pentru comandă și limitele testului izolat.
