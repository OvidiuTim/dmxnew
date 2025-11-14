import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SharedService } from '../../shared.service';
import { HttpClient } from '@angular/common/http';

interface SessionRow {
  in_time: string | null;
  out_time: string | null;
  duration_hms: string;
  open: boolean;
  session_id: number;
  worksite?: string | null;
}

interface LeaveCell {
  reason: 'CO' | 'CM' | 'ALT' | string;
  hours: string;
  multiplier: string;
}

interface DayRow {
  date: string;
  first_in: string | null;
  last_out: string | null;
  total_hms: string;
  entries: number;
  exits: number;
  sessions: SessionRow[];
  day_worksite?: string | null;
  leave?: LeaveCell | null;
}

type EditMode = 'sessions' | 'leave';

type SessEditRow = {
  session_id?: number;
  in: string;
  out: string;
  worksite?: string;
};

@Component({
  selector: 'app-userpontat',
  templateUrl: './userpontat.component.html',
  styleUrls: ['./userpontat.component.css']
})
export class UserpontatComponent implements OnInit {
  userId!: number;
  userName: string | null = null;

  selectedMonth = this.monthNow();
  startISO = '';
  endISO = '';

  loading = false;
  saving = false;
  error: string | null = null;

  days: DayRow[] = [];
  monthTotal = '00:00:00';
  monthSalary: number | null = null;

  // editor
  editingDate: string | null = null;
  mode: EditMode = 'sessions';

  // form „total” (îl păstrăm pentru compat)
  form = {
    totalHms: '',
    anchor: 'start' as 'start' | 'end' | 'custom',
    customStart: '',
    worksite: ''
  };

  // SESIUNI
  sessForm: SessEditRow[] = [{ in: '', out: '', worksite: '' }];

  // salariu orar luat din Users (backend)
  hourlyRate = 0;

  // LIPSA ZI DE LUCRU
  leaveForm = {
    reason: 'CO' as 'CO' | 'CM' | 'ALT',
    hours: 8 as number,
    rate: 0 as number,             // doar pentru afișare, vine din hourlyRate
    multiplierEnabled: false,
    multiplier: 1 as number
  };

  mapLeave: Record<string, string> = {
    CO: 'Concediu odihnă',
    CM: 'Concediu medical',
    ALT: 'Absență'
  };

  constructor(
    private route: ActivatedRoute,
    private api: SharedService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    this.computeBounds();
    this.load();
    this.refreshMonthSalary();
    this.fetchUserInfo();   // ← luăm numele și salariul/oră
  }

  // ================== HELPERS DATĂ/LUNĂ ==================
  monthNow(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  computeBounds(): void {
    const [y, m] = this.selectedMonth.split('-').map(Number);
    const end = new Date(y, m, 0).getDate();
    this.startISO = `${y}-${String(m).padStart(2, '0')}-01`;
    this.endISO = `${y}-${String(m).padStart(2, '0')}-${String(end).padStart(2, '0')}`;
  }

  onMonthChange(evt: Event): void {
    const val = (evt.target as HTMLInputElement).value;
    if (!val) return;
    this.selectedMonth = val;
    this.computeBounds();
    this.load();
    this.refreshMonthSalary();
  }

  // ================== API LOAD ==================
  load(): void {
    this.loading = true;
    this.error = null;

    this.api.getAttendanceRangeForUser(this.startISO, this.endISO, this.userId).subscribe({
      next: (res) => {
        const user = (res?.users || [])[0];
        if (user) this.userName = user.UserName;

        const blank = this.makeBlankCalendar();
        const map = new Map<string, DayRow>();
        if (user?.days) {
          for (const d of user.days as DayRow[]) map.set(d.date, d);
        }
        const merged: DayRow[] = blank.map(dr => map.get(dr.date) ?? dr);

        this.days = merged;
        this.monthTotal = this.sumMonth(merged);
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Nu pot încărca pontajul utilizatorului.';
        this.loading = false;
        console.error(err);
      }
    });
  }

private fetchUserInfo(): void {
  this.api.getUsrList().subscribe({
    next: (list: any[]) => {
      console.log('getUsrList() – list brut:', list);

      // caută userul după id (în caz că vine user_id în loc de UserId)
      const u = list.find(
        (x) => x.UserId === this.userId || x.user_id === this.userId
      );

      console.log('Utilizator găsit pentru pontaj (id=', this.userId, '):', u);

      if (!u) {
        console.warn('Niciun user cu id', this.userId, 'în getUsrList()');
        return;
      }

      // numele – folosim ce găsim
      this.userName = this.userName ?? (u.UserName ?? u.username ?? u.name);

      // încercăm mai multe denumiri pentru câmpul de tarif orar
      const rawField =
        u.hourly_rate ??
        u.hourlyRate ??
        u.HourlyRate ??
        u.hourlyrate ??
        u.rate_per_hour ??
        '0';

      console.log('Valoare brută tarif orar (rawField):', rawField);

      const rate = parseFloat(rawField);
      if (!isNaN(rate)) {
        this.hourlyRate = rate;
        this.leaveForm.rate = rate; // sincronizat cu formularul de concediu
        console.log('Tarif orar parsat:', rate);
      } else {
        console.warn('Nu pot parsa hourly_rate pentru user:', u);
      }
    },
    error: (err) => {
      console.error('Nu pot încărca lista de utilizatori pentru hourly_rate', err);
    }
  });
}


  makeBlankCalendar(): DayRow[] {
    const res: DayRow[] = [];
    const [y, m] = this.selectedMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      res.push({
        date,
        first_in: null,
        last_out: null,
        total_hms: '00:00:00',
        entries: 0,
        exits: 0,
        sessions: [],
        day_worksite: null,
        leave: null
      });
    }
    return res;
  }

  sumMonth(rows: DayRow[]): string {
    let total = 0;
    for (const r of rows) total += this.hmsToSec(r.total_hms);
    return this.secToHms(total);
  }

  private refreshMonthSalary(): void {
    this.api.getPayMonth(this.userId, this.selectedMonth).subscribe({
      next: (res) => {
        this.monthSalary = parseFloat(res?.month_total ?? '0');
      },
      error: () => {
        this.monthSalary = null;
      }
    });
  }

  // ================== FORMATĂRI UI ==================
  hmsToSec(hms: string): number {
    if (!hms) return 0;
    const [h, m, s] = hms.split(':').map(x => parseInt(x || '0', 10));
    return (h * 3600) + (m * 60) + (s || 0);
  }

  secToHms(sec: number): string {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  hm(t: string | null) { return t ? t.substring(0, 5) : '—'; }
  durataOre(hms: string) {
    const [h, m] = (hms || '00:00:00').split(':');
    return `${parseInt(h, 10)}:${m} ore`;
  }

  fmtLeaveHours(h: string): string {
    const n = parseFloat(h);
    if (isNaN(n)) return h;
    const clean = (Math.round(n * 100) / 100).toString().replace(/\.00?$/, '');
    return `${clean}h`;
  }

  // ================== EDITOR ==================
  openEditor(day: DayRow): void {
    this.editingDate = day.date;
    this.mode = 'sessions';

    // TOTAL (compat)
    this.form.totalHms = this.toHHMM(day.total_hms);
    this.form.anchor = 'start';
    this.form.customStart = '';
    this.form.worksite = day.day_worksite ?? '';

    // SESIUNI
    this.sessForm = (day.sessions?.length ? day.sessions : [])
      .map<SessEditRow>(s => ({
        session_id: s.session_id,
        in: this.hm(s.in_time),
        out: s.out_time ? this.hm(s.out_time) : '',
        worksite: s.worksite || ''
      }));
    if (!this.sessForm.length) {
      this.sessForm = [{ in: '', out: '', worksite: '' }];
    }

    // LIPSA ZI DE LUCRU
    if (day.leave) {
      const mh = parseFloat(day.leave.hours || '0');
      const mm = parseFloat(day.leave.multiplier || '1') || 1;
      this.leaveForm.reason = (['CO', 'CM', 'ALT'].includes(day.leave.reason) ? day.leave.reason : 'ALT') as any;
      this.leaveForm.hours = isNaN(mh) ? 0 : mh;
      this.leaveForm.multiplierEnabled = mm !== 1;
      this.leaveForm.multiplier = mm || 1;
    } else {
      this.leaveForm.reason = 'CO';
      this.leaveForm.hours = 8;
      this.leaveForm.multiplierEnabled = false;
      this.leaveForm.multiplier = 1;
    }

    // important: tariful orar vine din Users, nu din ce a fost scris manual
    this.leaveForm.rate = this.hourlyRate;
  }

  cancelEditor(): void {
    this.editingDate = null;
    this.saving = false;
  }

  addSessionRow(): void {
    this.sessForm.push({ in: '', out: '', worksite: '' });
  }

  removeSessionRow(i: number): void {
    if (this.sessForm.length > 1) this.sessForm.splice(i, 1);
  }

  deleteSingleSession(row: SessionRow): void {
    if (!row.session_id) return;
    if (!confirm('Ștergi această sesiune?')) return;

    this.saving = true;
    this.http.post('/api/pontaj/session/delete/', { session_id: row.session_id }).subscribe({
      next: () => {
        this.saving = false;
        this.load();
        this.refreshMonthSalary();
      },
      error: (err) => {
        this.saving = false;
        alert('Eroare la ștergerea sesiunii.');
        console.error(err);
      }
    });
  }

  clearDayConfirm(day: DayRow): void {
    if (!confirm(`Ștergi toate sesiunile pentru ${day.date}?`)) return;
    this.saving = true;
    this.api.deleteDay(this.userId, day.date).subscribe({
      next: () => {
        this.saving = false;
        this.editingDate = null;
        this.load();
        this.refreshMonthSalary();
      },
      error: (err) => {
        this.saving = false;
        alert('Eroare la ștergere zi.');
        console.error(err);
      }
    });
  }

  // ================== SAVE TOTAL ==================
  saveTotal(day: DayRow): void {
    if (!this.validHHMM(this.form.totalHms)) {
      alert('Total invalid. Folosește format HH:MM (ex: 07:30).');
      return;
    }
    if (this.form.anchor === 'custom' && !this.validHHMM(this.form.customStart)) {
      alert('Custom start invalid (HH:MM).');
      return;
    }

    this.saving = true;

    this.api.editDayTotal(
      this.userId,
      day.date,
      this.form.totalHms,
      {
        anchor: this.form.anchor,
        worksite: this.form.worksite?.trim() || undefined,
        customStart: this.form.anchor === 'custom' ? this.form.customStart : undefined
      }
    ).subscribe({
      next: () => {
        this.saving = false;
        this.editingDate = null;
        this.load();
        this.refreshMonthSalary();
      },
      error: (err) => {
        // fallback -> rescriem ziua cu o singură sesiune
        if (err?.status === 404 || err?.status === 405) {
          const totalMin = this.toMinutes(this.form.totalHms);
          let startHHMM = '08:00';
          let endHHMM = '17:00';

          if (this.form.anchor === 'custom' && this.form.customStart) {
            startHHMM = this.form.customStart;
            endHHMM = this.addMinutesHHMM(startHHMM, totalMin);
          } else if (this.form.anchor === 'start') {
            startHHMM = day.first_in ? this.hm(day.first_in) : '08:00';
            endHHMM = this.addMinutesHHMM(startHHMM, totalMin);
          } else {
            endHHMM = day.last_out ? this.hm(day.last_out) : '17:00';
            startHHMM = this.addMinutesHHMM(endHHMM, -totalMin);
          }

          const sessionsPayload = [{
            in: startHHMM,
            out: endHHMM,
            worksite: this.form.worksite?.trim() || undefined
          }];

          this.api.editDaySessions(this.userId, day.date, sessionsPayload, { replace: true, rewrite_presence: true })
            .subscribe({
              next: () => {
                this.saving = false;
                this.editingDate = null;
                this.load();
                this.refreshMonthSalary();
              },
              error: (e2) => {
                this.saving = false;
                alert('Eroare la salvarea totalului (fallback).');
                console.error(e2);
              }
            });
        } else {
          this.saving = false;
          alert('Eroare la salvarea totalului.');
          console.error(err);
        }
      }
    });
  }

  // ================== SAVE SESSIONS ==================
  saveSessions(day: DayRow): void {
    if (!this.sessForm.length) {
      alert('Adaugă cel puțin o sesiune.');
      return;
    }
    for (const r of this.sessForm) {
      if (!this.validHHMM(r.in) || !this.validHHMM(r.out)) {
        alert('Ore invalid format (HH:MM).');
        return;
      }
      const mi = this.toMinutes(r.in);
      const mo = this.toMinutes(r.out);
      if (mo <= mi) {
        alert('Ora de ieșire trebuie să fie după ora de intrare.');
        return;
      }
    }

    const payload = this.sessForm.map(r => ({
      in: r.in,
      out: r.out,
      worksite: r.worksite?.trim() || undefined
    }));

    this.saving = true;
    this.api.editDaySessions(this.userId, day.date, payload, { replace: true, rewrite_presence: true }).subscribe({
      next: () => {
        this.saving = false;
        this.editingDate = null;
        this.load();
        this.refreshMonthSalary();
      },
      error: (err) => {
        this.saving = false;
        alert('Eroare la salvarea sesiunilor.');
        console.error(err);
      }
    });
  }

  // ================== LEAVE (LIPSĂ ZI DE LUCRU) ==================
  leaveComputedTotal(): number {
    const hours = this.leaveForm.hours || 0;
    const mult = this.leaveForm.multiplierEnabled ? (this.leaveForm.multiplier || 1) : 1;
    const rate = this.hourlyRate || this.leaveForm.rate || 0;
    return +(hours * rate * mult).toFixed(2);
  }

  saveLeave(day: DayRow): void {
    if (!this.leaveForm.hours || this.leaveForm.hours < 0) {
      alert('Setează orele pontate pentru ziua lipsă.');
      return;
    }
    if (this.leaveForm.multiplierEnabled && this.leaveForm.multiplier < 0) {
      alert('Multiplicator invalid.');
      return;
    }

    const body = {
      user_id: this.userId,
      date: day.date,
      reason: this.leaveForm.reason,
      hours: this.leaveForm.hours,
      multiplier: this.leaveForm.multiplierEnabled ? this.leaveForm.multiplier : 1
      // hourly_rate NU se trimite -> serverul folosește Users.hourly_rate
    };

    this.saving = true;
    this.http.post('/api/leave/upsert/', body).subscribe({
      next: () => {
        this.saving = false;
        this.editingDate = null;
        this.load();
        this.refreshMonthSalary();
      },
      error: (err) => {
        this.saving = false;
        alert('Eroare la salvarea absenței.');
        console.error(err);
      }
    });
  }

  deleteLeave(day: DayRow): void {
    if (!confirm('Ștergi marcajul de lipsă pentru această zi?')) return;

    this.saving = true;
    // backend-ul tău acceptă POST aici, nu DELETE ⇒ folosim POST
    this.http.post('/api/leave/delete/', { user_id: this.userId, date: day.date }).subscribe({
      next: () => {
        this.saving = false;
        this.editingDate = null;
        this.load();
        this.refreshMonthSalary();
      },
      error: (err) => {
        this.saving = false;
        alert('Eroare la ștergerea absenței.');
        console.error(err);
      }
    });
  }

  // ================== UTILS MICI ==================
  private validHHMM(s: string): boolean {
    return /^[0-2]?\d:[0-5]\d$/.test(s);
  }

  private toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
    return h * 60 + m;
  }

  private toHHMM(hms: string): string {
    if (!hms) return '00:00';
    const [h, m] = hms.split(':');
    return `${h ?? '00'}:${m ?? '00'}`;
  }

  private addMinutesHHMM(hhmm: string, minutes: number): string {
    const total = this.toMinutes(hhmm) + minutes;
    const t = Math.max(0, total);
    const h = Math.floor(t / 60);
    const m = t % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
}
