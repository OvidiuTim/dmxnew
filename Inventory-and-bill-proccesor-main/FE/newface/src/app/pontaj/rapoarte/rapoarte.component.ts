import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SharedService } from '../../shared.service';

type ReportTab = 'worksites' | 'costs' | 'absences' | 'incomplete';

interface ReportFilters {
  start: string;
  end: string;
  company: string;
  worksite: string;
}

interface WorksitePersonRow {
  UserId: number;
  UserName: string;
  Company?: string | null;
  total_hms: string;
  sessions_count: number;
  days_count: number;
}

interface WorksiteRow {
  worksite: string;
  raw_worksite?: string | null;
  people_count: number;
  active_days_count: number;
  person_days_count: number;
  total_sessions: number;
  total_hms: string;
  last_activity?: string | null;
  people: WorksitePersonRow[];
}

@Component({
  selector: 'app-rapoarte',
  templateUrl: './rapoarte.component.html',
  styleUrls: ['./rapoarte.component.css']
})
export class RapoarteComponent implements OnInit {
  private readonly apiBase = '/api';
  readonly tabs: Array<{ id: ReportTab; label: string; icon: string }> = [
    { id: 'worksites', label: 'Oameni pe șantier', icon: 'domain' },
    { id: 'costs', label: 'Costuri', icon: 'payments' },
    { id: 'absences', label: 'Absențe', icon: 'person_off' },
    { id: 'incomplete', label: 'Pontaje incomplete', icon: 'pending_actions' },
  ];

  activeTab: ReportTab = 'worksites';
  filters: ReportFilters = {
    start: this.currentMonthStartISO(),
    end: this.todayISO(),
    company: '',
    worksite: '',
  };
  companies: string[] = [];
  worksites: string[] = [];
  selectedCompany = '';
  monthValue = this.currentMonthISO();
  companyError: string | null = null;
  companyExporting = false;
  loading = false;
  reportError: string | null = null;
  rowLimit = 60;

  worksiteSummary: any = null;
  worksiteRows: WorksiteRow[] = [];
  expandedWorksite: string | null = null;
  worksiteEmployeeSearch: Record<string, string> = {};
  costSummary: any = null;
  costCompanies: any[] = [];
  costWorksites: any[] = [];
  costPeople: any[] = [];
  absenceSummary: any = null;
  absenceRows: any[] = [];
  incompleteSummary: any = null;
  incompleteRows: any[] = [];

  constructor(
    private http: HttpClient,
    public router: Router,
    private api: SharedService,
  ) {}

  ngOnInit(): void {
    this.loadReportOptions();
    this.loadActiveReport();
  }

  todayISO(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  currentMonthISO(): string {
    return this.todayISO().slice(0, 7);
  }

  currentMonthStartISO(): string {
    return `${this.currentMonthISO()}-01`;
  }

  switchTab(tab: ReportTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.rowLimit = 60;
    this.reportError = null;
    this.loadActiveReport();
  }

  loadReportOptions(): void {
    this.api.getAttendanceReportOptions().subscribe({
      next: (response) => {
        this.companies = response?.companies ?? [];
        this.worksites = response?.worksites ?? [];
        if (!this.selectedCompany && this.companies.length) this.selectedCompany = this.companies[0];
      },
      error: () => this.loadCompaniesFallback(),
    });
  }

  private loadCompaniesFallback(): void {
    this.api.getUsrList().subscribe({
      next: (users: any[]) => {
        this.companies = Array.from(new Set(
          users.map(user => String(user.Company || '').trim()).filter(Boolean)
        )).sort((a, b) => a.localeCompare(b, 'ro'));
        if (!this.selectedCompany && this.companies.length) this.selectedCompany = this.companies[0];
      },
      error: (error) => console.error('Nu pot încărca firmele pentru rapoarte.', error),
    });
  }

  applyFilters(): void {
    this.reportError = null;
    if (!this.filters.start || !this.filters.end) {
      this.reportError = 'Selectează perioada raportului.';
      return;
    }
    if (this.filters.start > this.filters.end) {
      this.reportError = 'Data de început trebuie să fie înainte de data de sfârșit.';
      return;
    }
    this.rowLimit = 60;
    this.loadActiveReport();
  }

  loadActiveReport(): void {
    if (!this.filters.start || !this.filters.end || this.filters.start > this.filters.end) return;
    this.loading = true;
    this.reportError = null;
    const company = this.filters.company || null;
    const worksite = this.filters.worksite || null;

    if (this.activeTab === 'worksites') {
      this.api.getAttendanceWorksiteReport(this.filters.start, this.filters.end, company, worksite).subscribe({
        next: response => {
          this.worksiteSummary = response?.summary ?? null;
          this.worksiteRows = response?.rows ?? [];
          this.expandedWorksite = null;
          this.finishLoading();
        },
        error: error => this.failLoading(error, 'Nu am putut încărca raportul pe șantiere.'),
      });
      return;
    }
    if (this.activeTab === 'costs') {
      this.api.getAttendanceCostReport(this.filters.start, this.filters.end, company, worksite).subscribe({
        next: response => {
          this.costSummary = response?.summary ?? null;
          this.costCompanies = response?.companies ?? [];
          this.costWorksites = response?.worksites ?? [];
          this.costPeople = response?.people ?? [];
          this.finishLoading();
        },
        error: error => this.failLoading(error, 'Nu am putut calcula raportul de costuri.'),
      });
      return;
    }
    if (this.activeTab === 'absences') {
      this.api.getAttendanceAbsenceReport(this.filters.start, this.filters.end, company, worksite).subscribe({
        next: response => {
          this.absenceSummary = response?.summary ?? null;
          this.absenceRows = response?.rows ?? [];
          this.finishLoading();
        },
        error: error => this.failLoading(error, 'Nu am putut încărca raportul de absențe.'),
      });
      return;
    }
    this.api.getAttendanceIncompleteReport(this.filters.start, this.filters.end, company, worksite).subscribe({
      next: response => {
        this.incompleteSummary = response?.summary ?? null;
        this.incompleteRows = response?.rows ?? [];
        this.finishLoading();
      },
      error: error => this.failLoading(error, 'Nu am putut încărca pontajele incomplete.'),
    });
  }

  private finishLoading(): void { this.loading = false; }

  private failLoading(error: unknown, message: string): void {
    console.error(error);
    this.loading = false;
    this.reportError = message;
  }

  get activeTitle(): string {
    return this.tabs.find(tab => tab.id === this.activeTab)?.label ?? 'Raport';
  }

  get activeDescription(): string {
    const descriptions: Record<ReportTab, string> = {
      worksites: 'Vezi oamenii unici, orele și activitatea pentru fiecare șantier.',
      costs: 'Analizează costurile pe firme, șantiere și angajați pentru perioada selectată.',
      absences: 'Urmărește separat lipsa pontajului și fiecare tip de concediu.',
      incomplete: 'Identifică sesiunile care au check-in, dar nu au încă check-out.',
    };
    return descriptions[this.activeTab];
  }

  toggleWorksitePeople(row: WorksiteRow): void {
    const key = this.worksiteKey(row);
    this.expandedWorksite = this.expandedWorksite === key ? null : key;
  }

  worksiteKey(row: WorksiteRow): string {
    return row.raw_worksite || row.worksite || '__no_worksite__';
  }

  filteredWorksitePeople(row: WorksiteRow): WorksitePersonRow[] {
    const query = (this.worksiteEmployeeSearch[this.worksiteKey(row)] || '').trim().toLocaleLowerCase('ro');
    if (!query) return row.people;
    return row.people.filter(person => `${person.UserName} ${person.Company || ''}`.toLocaleLowerCase('ro').includes(query));
  }

  openAttendance(userId: number): void { this.router.navigate(['/user', userId]); }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('ro-RO');
  }

  formatDateTime(value?: string | null): string {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('ro-RO', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  asNumber(value: unknown): number {
    const result = Number(value ?? 0);
    return Number.isFinite(result) ? result : 0;
  }

  showMore(): void { this.rowLimit += 60; }

  downloadCompanyMonthReport(): void {
    this.companyError = null;
    if (!this.selectedCompany || !this.monthValue) {
      this.companyError = 'Selectează firma și luna.';
      return;
    }
    const [yearText, monthText] = this.monthValue.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) {
      this.companyError = 'Luna selectată nu este validă.';
      return;
    }
    this.companyExporting = true;
    this.http.post(`${this.apiBase}/pontaj/excel/`, {
      month, year, company: this.selectedCompany,
    }, { responseType: 'blob' }).subscribe({
      next: blob => {
        this.triggerDownload(blob, `pontaj_${this.filePart(this.selectedCompany)}_${this.monthValue}.xlsx`);
        this.companyExporting = false;
      },
      error: error => {
        console.error(error);
        this.companyError = 'Eroare la generarea raportului Excel.';
        this.companyExporting = false;
      },
    });
  }

  exportActiveCsv(): void {
    let header: string[] = [];
    let rows: Array<Array<unknown>> = [];
    if (this.activeTab === 'worksites') {
      header = ['Șantier', 'Oameni unici', 'Ore totale', 'Sesiuni', 'Zile active', 'Om-zile', 'Ultima activitate'];
      rows = this.worksiteRows.map(row => [row.worksite, row.people_count, row.total_hms, row.total_sessions, row.active_days_count, row.person_days_count, this.formatDateTime(row.last_activity)]);
    } else if (this.activeTab === 'costs') {
      header = ['Angajat', 'Serie', 'Firmă', 'Șantiere', 'Tarif orar', 'Ore totale', 'Cost estimat'];
      rows = this.costPeople.map(person => [person.UserName, person.UserSerie, person.Company, (person.worksites || []).join('; '), person.hourly_rate, person.total_hms, person.total_cost]);
    } else if (this.activeTab === 'absences') {
      header = ['Data', 'Angajat', 'Serie', 'Firmă', 'Șantier', 'Tip'];
      rows = this.absenceRows.map(row => [row.date, row.UserName, row.UserSerie, row.Company, row.worksite, row.reason_label]);
    } else {
      header = ['Data', 'Angajat', 'Serie', 'Firmă', 'Șantier', 'Check-in', 'Timp deschis'];
      rows = this.incompleteRows.map(row => [row.date, row.UserName, row.UserSerie, row.Company, row.worksite, this.formatDateTime(row.check_in), row.elapsed_hms]);
    }
    if (!rows.length) {
      this.reportError = 'Nu există date de exportat pentru filtrele selectate.';
      return;
    }
    const csv = [header, ...rows].map(row => row.map(value => this.csvCell(value)).join(',')).join('\r\n');
    this.triggerDownload(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' }), `${this.activeTab}_${this.filters.start}_${this.filters.end}.csv`);
  }

  private csvCell(value: unknown): string {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  private filePart(value: string): string {
    return value.trim().replace(/[^a-zA-Z0-9ăâîșțĂÂÎȘȚ_-]+/g, '_');
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }
}
