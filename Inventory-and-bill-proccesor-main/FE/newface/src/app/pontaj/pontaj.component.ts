import { Component, OnInit } from '@angular/core';
import { SharedService } from '../shared.service';
import { forkJoin } from 'rxjs';
import { Router } from '@angular/router';


interface SessionRow {
  in_time: string | null;     // "HH:MM:SS"
  out_time: string | null;    // "HH:MM:SS" sau null dacă e deschisă
  duration_hms: string;       // "HH:MM:SS"
  open: boolean;
  session_id: number;
}

interface DayUserRow {
  UserId: number;
  UserName: string;
  first_in: string | null;    // ISO local time sau null
  last_out: string | null;    // ISO local time sau null
  total_hms: string;          // "HH:MM:SS"
  status: 'IN' | 'OUT' | 'ABSENT';
  sessions: SessionRow[];
}

@Component({
  selector: 'app-pontaj',
  templateUrl: './pontaj.component.html',
  styleUrls: ['./pontaj.component.css']
})
export class PontajComponent implements OnInit {
  selectedDate = this.todayISO();            // YYYY-MM-DD (pt API)
  displayDate = this.formatDisplay(this.selectedDate);
  showDatePicker = false;

  loading = false;
  error: string | null = null;

  rows: DayUserRow[] = [];                   // toți userii (inclusiv absenți)
  totalUsers = 0;
  presentNow = 0;

  constructor(private api: SharedService, private router: Router) {}

  ngOnInit(): void {
    this.loadDay();
  }

seeAngajat(id: number) {
  this.router.navigate(['/user', id]);            // corect
  // sau: this.router.navigateByUrl(`/pontaj/user/${id}`); // tot OK, dar nu e nevoie de /pontaj
}

  loadDay(): void {
    this.loading = true;
    this.error = null;
    // aducem atât raportul pe zi cât și lista completă de useri (ca să afișăm și absenții)
    forkJoin({
      day: this.api.getAttendanceDay(this.selectedDate),
      users: this.api.getUsrList()
    }).subscribe({
      next: ({ day, users }) => {
        const byId = new Map<number, DayUserRow>();
        for (const r of (day?.rows ?? [])) {
          byId.set(r.UserId, r);
        }
        const merged: DayUserRow[] = users.map((u: any) => {
          const hit = byId.get(u.UserId);
          if (hit) return hit;
          // absent — nu are sesiuni în ziua aleasă
          return {
            UserId: u.UserId,
            UserName: u.UserName,
            first_in: null,
            last_out: null,
            total_hms: '00:00:00',
            status: 'ABSENT',
            sessions: []
          };
        });

        // sort alfabetic
        merged.sort((a, b) => a.UserName.localeCompare(b.UserName, 'ro'));

        this.rows = merged;
        this.totalUsers = merged.length;
        this.presentNow = merged.filter(r => r.status === 'IN').length;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Nu pot încărca pontajul. Verifică API-ul.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  togglePicker(): void {
    this.showDatePicker = !this.showDatePicker;
  }

  onDatePicked(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const val = input.value;            // YYYY-MM-DD
    if (!val) return;
    this.selectedDate = val;
    this.displayDate = this.formatDisplay(val);
    this.showDatePicker = false;
    this.loadDay();
  }

  refresh(): void {
    this.loadDay();
  }

  trackByUser = (_: number, row: DayUserRow) => row.UserId;

  // ---- helpers de afișare ----
  todayISO(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  private formatDisplay(isoDate: string): string {
    try {
      const d = new Date(isoDate + 'T00:00:00');
      return d.toLocaleDateString('ro-RO', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' });
    } catch {
      return isoDate;
    }
  }

  hm(time: string | null): string {
    if (!time) return '—';
    return time.substring(0,5); // HH:MM
  }

  durataOre(hms: string): string {
    // "HH:MM:SS" -> "H:MM ore"
    if (!hms) return '0:00 ore';
    const [h, m] = hms.split(':');
    const H = String(parseInt(h, 10)); // scăpăm de zero-leading
    return `${H}:${m} ore`;
  }

  statusChipClass(status: DayUserRow['status']): string {
    return {
      'IN': 'chip in',
      'OUT': 'chip out',
      'ABSENT': 'chip absent'
    }[status];
  }
}

