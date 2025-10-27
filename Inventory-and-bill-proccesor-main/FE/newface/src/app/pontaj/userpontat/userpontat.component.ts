import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SharedService } from '../../shared.service';





interface SessionRow {
  in_time: string | null;
  out_time: string | null;
  duration_hms: string;
  open: boolean;
  session_id: number;
  worksite?: string | null; // deja OK
}
interface DayRow {
  date: string;
  first_in: string | null;
  last_out: string | null;
  total_hms: string;
  entries: number;
  exits: number;
  sessions: SessionRow[];
  day_worksite?: string | null; // deja OK
}


@Component({
  selector: 'app-userpontat',
  templateUrl: './userpontat.component.html',
  styleUrls: ['./userpontat.component.css']
})
export class UserpontatComponent implements OnInit {
  userId!: number;
  userName: string | null = null;

  selectedMonth = this.monthNow(); // "YYYY-MM"
  startISO = '';
  endISO = '';

  loading = false;
  error: string | null = null;

  days: DayRow[] = [];
  monthTotal = '00:00:00';

  constructor(private route: ActivatedRoute, private api: SharedService) { }

  ngOnInit(): void {
    this.userId = Number(this.route.snapshot.paramMap.get('id'));
    this.computeBounds();
    this.load();
  }

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
  }

  load(): void {
    this.loading = true; this.error = null;
    this.api.getAttendanceRangeForUser(this.startISO, this.endISO, this.userId).subscribe({
      next: (res) => {
        const user = (res?.users || [])[0];
        // fallback nume
        if (user) this.userName = user.UserName;

        // construiesc calendarul întreg al lunii
        const blank = this.makeBlankCalendar();
        const map = new Map<string, DayRow>();
        if (user?.days) {
          for (const d of user.days as DayRow[]) map.set(d.date, d);
        }
        const merged: DayRow[] = blank.map(dr => {
          const hit = map.get(dr.date);
          if (hit) return hit;
          return dr;
        });

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

    // nume fallback dacă API-ul nu-l include
    if (!this.userName) {
      this.api.getUsrList().subscribe(list => {
        const u = list.find((x: any) => x.UserId === this.userId);
        if (u) this.userName = u.UserName;
      });
    }
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
        day_worksite: null, // ADĂUGAT
      });
    }
    return res;
  }

  sumMonth(rows: DayRow[]): string {
    let total = 0;
    for (const r of rows) total += this.hmsToSec(r.total_hms);
    return this.secToHms(total);
  }
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
  durataOre(hms: string) { const [h, m] = (hms || '00:00:00').split(':'); return `${parseInt(h, 10)}:${m} ore`; }
}