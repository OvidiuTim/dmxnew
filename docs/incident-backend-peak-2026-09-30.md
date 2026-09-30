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
