import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SharedService } from '../../shared.service';
import { forkJoin } from 'rxjs';


@Component({
  selector: 'app-rapoarte',
  templateUrl: './rapoarte.component.html',
  styleUrls: ['./rapoarte.component.css']
})
export class RapoarteComponent {
  // API de bază – relativ la domeniu (se duce în Nginx la Django)
  private readonly apiBase = '/api';

  // Raport pe zi
  dayDate = this.todayISO();
  dayError: string | null = null;

  // Raport pe firmă + lună
  companies: string[] = ['Servicex', 'VB-ROM']; // adaugă aici și alte firme dacă vrei
  selectedCompany: string | null = null;
  monthValue = this.currentMonthISO();
  companyError: string | null = null;

  // ---- Costuri salariale pe firmă (lunar) ----
  currentYear = new Date().getFullYear();
  years = [this.currentYear - 1, this.currentYear, this.currentYear + 1];

  months = [
    { value: 1,  label: 'Ianuarie' },
    { value: 2,  label: 'Februarie' },
    { value: 3,  label: 'Martie' },
    { value: 4,  label: 'Aprilie' },
    { value: 5,  label: 'Mai' },
    { value: 6,  label: 'Iunie' },
    { value: 7,  label: 'Iulie' },
    { value: 8,  label: 'August' },
    { value: 9,  label: 'Septembrie' },
    { value: 10, label: 'Octombrie' },
    { value: 11, label: 'Noiembrie' },
    { value: 12, label: 'Decembrie' },
  ];

  salaryYear: number = this.currentYear;
  salaryMonth: number = new Date().getMonth() + 1;   // 1–12
  salaryCompany: string | null = null;

  loadingSalary = false;
  salaryError: string | null = null;
  currentSalaryCompany: string | null = null;

  salaryResult: { company: string; month: string; total: number } | null = null;



  constructor(
    private http: HttpClient,
    private router: Router,
    private api: SharedService,
  ) {}

  /* NAV BAR */
  backToPontaj(): void {
    this.router.navigate(['/pontaj']);
  }

  /* Helpers date */

  todayISO(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  currentMonthISO(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  }

  /* Raport pe zi – CSV din /api/pontaj/day/ */

  downloadDayReport(): void {
    this.dayError = null;
    if (!this.dayDate) {
      this.dayError = 'Alege o dată.';
      return;
    }

    const url = `${this.apiBase}/pontaj/day/`;

    this.http.get<any>(url, { params: { date: this.dayDate } }).subscribe({
      next: (res) => {
        const rows = res?.rows ?? [];
        if (!rows.length) {
          this.dayError = 'Nu există pontaj pentru data aleasă.';
          return;
        }

        const header = ['UserName', 'first_in', 'last_out', 'total_hms', 'status'];
        const lines = [header.join(',')];

        for (const r of rows) {
          const vals = [
            `"${(r.UserName || '').replace(/"/g, '""')}"`,
            r.first_in || '',
            r.last_out || '',
            r.total_hms || '',
            r.status || ''
          ];
          lines.push(vals.join(','));
        }

        const csv = lines.join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const fname = `raport_${this.dayDate}.csv`;
        this.triggerDownload(blob, fname);
      },
      error: (err) => {
        console.error(err);
        this.dayError = 'Eroare la generarea raportului pe zi.';
      }
    });
  }

  /* Raport pe firmă + lună – .xlsx din /api/pontaj/excel/ */

  selectCompany(c: string): void {
    this.selectedCompany = c;
    this.companyError = null;
  }

  downloadCompanyMonthReport(): void {
    this.companyError = null;

    if (!this.selectedCompany) {
      this.companyError = 'Alege o firmă.';
      return;
    }
    if (!this.monthValue) {
      this.companyError = 'Alege o lună.';
      return;
    }

    // monthValue = "YYYY-MM"
    const [yearStr, monthStr] = this.monthValue.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (!year || !month) {
      this.companyError = 'Luna selectată nu este validă.';
      return;
    }

    const url = `${this.apiBase}/pontaj/excel/`;
    const body = {
      month,
      year,
      company: this.selectedCompany
    };

    this.http.post(url, body, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const fname = `pontaj_${this.selectedCompany!.replace(/\s+/g, '_')}_${yearStr}-${monthStr}.xlsx`;
        this.triggerDownload(blob, fname);
      },
      error: (err) => {
        console.error(err);
        this.companyError = 'Eroare la generarea raportului pe firmă.';
      }
    });
  }

  /* Utilitar pentru download */

  private triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }


  loadSalaryCost(): void {
    if (!this.salaryYear || !this.salaryMonth || !this.salaryCompany) {
      this.salaryError = 'Alege anul, luna și firma.';
      return;
    }

    this.salaryError = null;
    this.loadingSalary = true;
    this.currentSalaryCompany = this.salaryCompany;
    this.salaryResult = null;

    const monthStr = `${this.salaryYear}-${String(this.salaryMonth).padStart(2, '0')}`; // "YYYY-MM"
    const company = this.salaryCompany;

    // 1) luăm toți angajații și filtrăm pe firmă
    this.api.getUsrList().subscribe({
      next: (users: any[]) => {
        const companyUsers = users.filter(u =>
          (u.Company || '').toLowerCase() === company!.toLowerCase()
        );

        if (!companyUsers.length) {
          this.loadingSalary = false;
          this.salaryError = 'Nu există angajați pentru firma ' + company;
          return;
        }

        // 2) pentru fiecare angajat din firmă, cerem /pay/month și adunăm
        const calls = companyUsers.map(u =>
          this.api.getPayMonth(u.UserId, monthStr)
        );

        forkJoin(calls).subscribe({
          next: (results: any[]) => {
            let total = 0;
            for (const r of results) {
              const raw = r?.month_total ?? r?.monthTotal ?? '0';
              const val = parseFloat(raw);
              if (!Number.isNaN(val)) {
                total += val;
              }
            }

            this.salaryResult = {
              company: company!,
              month: monthStr,
              total
            };
            this.loadingSalary = false;
          },
          error: (err) => {
            console.error(err);
            this.salaryError = 'Eroare la calculul costurilor salariale.';
            this.loadingSalary = false;
          }
        });
      },
      error: (err) => {
        console.error(err);
        this.salaryError = 'Nu am putut încărca lista de angajați.';
        this.loadingSalary = false;
      }
    });
  }


}
