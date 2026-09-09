import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { AttendancePoint, AuditEvent, ConstructionSite, SiteApiService, SiteExpense, SitesResponse } from './site-api.service';

type SiteForm = {
  code: string; name: string; status: string; client: string; manager: string; address: string;
  latitude: number | null; longitude: number | null; start_date: string; end_date: string;
  budget: string | null; notes: string; points: string[]; version?: number;
};

@Component({
  selector: 'app-construction-sites', standalone: true, imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './construction-sites.component.html', styleUrls: ['./construction-sites.component.css']
})
export class ConstructionSitesComponent implements OnInit, OnDestroy {
  @ViewChild('siteDialog', { static: true }) siteDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('expenseDialog', { static: true }) expenseDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('cancelDialog', { static: true }) cancelDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('siteNgForm') siteNgForm?: NgForm;
  @ViewChild('expenseNgForm') expenseNgForm?: NgForm;
  data?: SitesResponse;
  selectedId: number | null = null;
  loading = false;
  detailLoading = false;
  saving = false;
  error = '';
  formError = '';
  notice = '';
  search = '';
  employeeSearch = '';
  status = '';
  start = this.localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  end = this.localDate(new Date());
  appliedStart = this.start;
  appliedEnd = this.end;
  tab: 'employees' | 'expenses' | 'details' | 'audit' = 'employees';
  expenses: SiteExpense[] = [];
  expenseCount = 0;
  expensePage = 1;
  events: AuditEvent[] = [];
  auditCount = 0;
  auditPage = 1;
  editingId: number | null = null;
  form: SiteForm = this.emptyForm();
  expenseForm = this.emptyExpense();
  cancelling?: SiteExpense;
  cancelReason = '';
  readonly statuses = [
    { value: 'active', label: 'Activ' }, { value: 'planned', label: 'Planificat' },
    { value: 'paused', label: 'Suspendat' }, { value: 'completed', label: 'Finalizat' }, { value: 'archived', label: 'Arhivat' }
  ];
  private destroyed = new Subject<void>();
  private loadSubscription?: Subscription;
  private detailSubscription?: Subscription;
  private numberFormat = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  constructor(private api: SiteApiService, private route: ActivatedRoute, private router: Router) {}
  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroyed)).subscribe(params => {
      this.selectedId = params.has('id') ? Number(params.get('id')) : null;
      this.tab = 'employees'; this.expensePage = 1; this.auditPage = 1;
      this.employeeSearch = '';
      this.load();
    });
  }
  ngOnDestroy(): void {
    this.loadSubscription?.unsubscribe(); this.detailSubscription?.unsubscribe();
    this.destroyed.next(); this.destroyed.complete();
  }
  private localDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  private emptyForm(): SiteForm {
    return { code: '', name: '', status: 'active', client: '', manager: '', address: '', latitude: null, longitude: null,
      start_date: '', end_date: '', budget: null, notes: '', points: [] };
  }
  private uuid(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  private emptyExpense() {
    return { date: this.localDate(new Date()), category: 'materials', description: '', supplier: '', reference: '', amount: null as string | null,
      notes: '', request_id: this.uuid() };
  }
  get selected(): ConstructionSite | undefined { return this.data?.sites.find(site => site.id === this.selectedId); }
  get currentCosts() { return this.selected?.costs || this.data?.totals; }
  get filteredSites(): ConstructionSite[] {
    const query = this.search.trim().toLocaleLowerCase('ro');
    return (this.data?.sites || []).filter(site => (!this.status || site.status === this.status) &&
      (!query || [site.name, site.code, site.client, site.manager, ...site.points].join(' ').toLocaleLowerCase('ro').includes(query)));
  }
  get filteredEmployees() {
    const query = this.employeeSearch.trim().toLocaleLowerCase('ro');
    return (this.selected?.costs.employees || []).filter(employee =>
      [employee.name, employee.serie, employee.company].join(' ').toLocaleLowerCase('ro').includes(query));
  }
  get selectedPoints(): AttendancePoint[] { return (this.data?.points || []).filter(point => this.form.points.includes(point.name)); }
  get availablePointCount(): number { return this.data?.points.filter(point => point.is_primary && !point.site_id).length || 0; }
  get importedHours(): number { return this.selectedPoints.reduce((sum, point) => sum + (point.history?.seconds || 0) / 3600, 0); }
  get importedCost(): number { return this.selectedPoints.reduce((sum, point) => sum + Number(point.history?.cost || 0), 0); }
  amount(value: unknown): string { return this.numberFormat.format(Number(value || 0)); }
  statusLabel(value: string): string { return this.statuses.find(status => status.value === value)?.label || value; }
  categoryLabel(value: string): string { return this.data?.categories.find(category => category.value === value)?.label || value; }
  budgetPercent(site: ConstructionSite): number {
    return site.budget && Number(site.budget) > 0 ? Math.min(100, 100 * Number(site.lifetime_cost) / Number(site.budget)) : 0;
  }
  overBudget(site: ConstructionSite): boolean { return site.budget_remaining !== null && Number(site.budget_remaining) < 0; }
  mapUrl(site: ConstructionSite): string {
    return `https://www.google.com/maps?q=${site.latitude},${site.longitude}`;
  }
  load(): void {
    if (this.start && this.end && this.start > this.end) { this.error = 'Data de început trebuie să fie înaintea datei finale.'; return; }
    this.loadSubscription?.unsubscribe(); this.detailSubscription?.unsubscribe();
    this.loading = true; this.error = '';
    const start = this.start, end = this.end;
    this.loadSubscription = this.api.list(start, end).subscribe({
      next: data => {
        this.data = data; this.loading = false; this.appliedStart = start; this.appliedEnd = end;
        if (this.selectedId !== null && !this.selected) this.error = 'Șantierul nu a fost găsit.';
        this.loadDetail();
      },
      error: error => { this.loading = false; this.error = this.errorText(error); }
    });
  }
  allHistory(): void { this.start = ''; this.end = ''; this.expensePage = 1; this.load(); }
  applyPeriod(): void { this.expensePage = 1; this.load(); }
  setTab(tab: typeof this.tab): void { this.tab = tab; this.loadDetail(); }
  loadDetail(): void {
    this.detailSubscription?.unsubscribe(); this.detailLoading = false;
    if (!this.selected) return;
    if (this.tab === 'expenses') {
      this.detailLoading = true; this.expenses = [];
      this.detailSubscription = this.api.expenses(this.selected.id, this.appliedStart, this.appliedEnd, this.expensePage).subscribe({
        next: result => { this.expenses = result.expenses; this.expenseCount = result.count; this.detailLoading = false; },
        error: error => { this.detailLoading = false; this.error = this.errorText(error); }
      });
    } else if (this.tab === 'audit') {
      this.detailLoading = true; this.events = [];
      this.detailSubscription = this.api.audit(this.selected.id, this.auditPage).subscribe({
        next: result => { this.events = result.events; this.auditCount = result.count; this.detailLoading = false; },
        error: error => { this.detailLoading = false; this.error = this.errorText(error); }
      });
    }
  }
  edit(site?: ConstructionSite, point?: AttendancePoint): void {
    this.editingId = site?.id || null;
    this.form = site ? { code: site.code, name: site.name, status: site.status, client: site.client, manager: site.manager,
      address: site.address, latitude: site.latitude, longitude: site.longitude, start_date: site.start_date || '',
      end_date: site.end_date || '', budget: site.budget, notes: site.notes, points: [...site.points], version: site.version } : this.emptyForm();
    if (!site) {
      let index = (this.data?.sites.length || 0) + 1;
      while (this.data?.sites.some(item => item.code === `S-${String(index).padStart(3, '0')}`)) index++;
      this.form.code = `S-${String(index).padStart(3, '0')}`;
    }
    if (point) this.togglePoint(point, true);
    this.formError = ''; this.siteNgForm?.resetForm(this.form); this.siteDialog.nativeElement.showModal();
  }
  togglePoint(point: AttendancePoint, checked: boolean): void {
    this.form.points = checked ? [...new Set([...this.form.points, point.name])] : this.form.points.filter(name => name !== point.name);
    if (checked && !this.editingId) {
      if (!this.form.name) this.form.name = point.name;
      if (this.form.latitude === null && this.form.longitude === null) {
        this.form.latitude = point.latitude; this.form.longitude = point.longitude;
      }
    }
  }
  saveSite(): void {
    if (this.saving || this.siteNgForm?.invalid) return;
    this.saving = true; this.formError = '';
    const payload = { ...this.form, start_date: this.form.start_date || null, end_date: this.form.end_date || null,
      budget: this.form.budget === '' ? null : this.form.budget };
    this.api.save(this.editingId, payload).pipe(takeUntil(this.destroyed)).subscribe({
      next: result => {
        this.saving = false; this.siteDialog.nativeElement.close(); this.notice = 'Șantier salvat. Pontajele asociate sunt incluse automat.';
        if (this.selectedId === result.site.id) this.load(); else this.router.navigate(['/santiere', result.site.id]);
      }, error: error => { this.saving = false; this.formError = this.errorText(error); }
    });
  }
  importPoints(): void {
    if (this.saving) return;
    this.saving = true; this.error = '';
    this.api.importPoints().pipe(takeUntil(this.destroyed)).subscribe({
      next: result => { this.saving = false; this.notice = `${result.created_count} șantiere create din punctele disponibile. Istoricul este deja inclus.`; this.load(); },
      error: error => { this.saving = false; this.error = this.errorText(error); }
    });
  }
  newExpense(): void {
    this.expenseForm = this.emptyExpense(); this.formError = ''; this.expenseNgForm?.resetForm(this.expenseForm);
    this.expenseDialog.nativeElement.showModal();
  }
  saveExpense(): void {
    if (!this.selected || this.saving || this.expenseNgForm?.invalid) return;
    this.saving = true; this.formError = '';
    this.api.addExpense(this.selected.id, this.expenseForm).pipe(takeUntil(this.destroyed)).subscribe({
      next: () => { this.saving = false; this.expenseDialog.nativeElement.close(); this.notice = 'Cheltuială înregistrată.'; this.expensePage = 1; this.load(); },
      error: error => { this.saving = false; this.formError = this.errorText(error); }
    });
  }
  askCancel(expense: SiteExpense): void {
    this.cancelling = expense; this.cancelReason = ''; this.formError = ''; this.cancelDialog.nativeElement.showModal();
  }
  cancelExpense(): void {
    if (!this.selected || !this.cancelling || !this.cancelReason.trim() || this.saving) return;
    this.saving = true; this.formError = '';
    this.api.cancelExpense(this.selected.id, this.cancelling.id, this.cancelReason).pipe(takeUntil(this.destroyed)).subscribe({
      next: () => { this.saving = false; this.cancelDialog.nativeElement.close(); this.notice = 'Cheltuiala a fost anulată și păstrată în istoric.'; this.load(); },
      error: error => { this.saving = false; this.formError = this.errorText(error); }
    });
  }
  closeDialog(dialog: HTMLDialogElement): void { if (!this.saving) dialog.close(); }
  auditLabel(action: string): string {
    return ({ created: 'Șantier creat', imported: 'Punct de pontaj importat', updated: 'Șantier actualizat',
      expense_created: 'Cheltuială adăugată', expense_cancelled: 'Cheltuială anulată' } as Record<string, string>)[action] || action;
  }
  auditChanges(event: AuditEvent): string {
    const labels: Record<string, string> = { name: 'Denumire', code: 'Cod', status: 'Status', client: 'Beneficiar', manager: 'Responsabil', address: 'Adresă',
      latitude: 'Latitudine', longitude: 'Longitudine', start_date: 'Început', end_date: 'Final', budget: 'Buget', notes: 'Note', points: 'Puncte de pontaj',
      description: 'Descriere', amount: 'Sumă', reference: 'Document', supplier: 'Furnizor', category: 'Categorie', date: 'Dată', cancellation_reason: 'Motiv anulare' };
    const display = (key: string, value: unknown): string => {
      if (value === null || value === undefined || value === '') return '—';
      if (key === 'status') return this.statusLabel(String(value));
      if (key === 'category') return this.categoryLabel(String(value));
      if (key === 'budget' || key === 'amount') return this.amount(value) + ' RON';
      return Array.isArray(value) ? value.join(', ') || '—' : String(value);
    };
    return Object.keys(labels).filter(key => display(key, event.before[key]) !== display(key, event.after[key]))
      .map(key => `${labels[key]}: ${display(key, event.before[key])} → ${display(key, event.after[key])}`).join('\n');
  }
  exportCsv(): void {
    if (this.selected && this.tab === 'expenses') {
      const code = this.selected.code;
      this.api.exportExpenses(this.selected.id, this.appliedStart, this.appliedEnd).pipe(takeUntil(this.destroyed)).subscribe({
        next: blob => this.download(blob, `santier-${code}-cheltuieli.csv`),
        error: error => { this.error = this.errorText(error); }
      });
      return;
    }
    let rows: unknown[][];
    if (this.selected) {
      rows = [['Șantier', 'Angajat', 'Serie', 'Firmă', 'Ore', 'Cost RON', 'Ore estimate', 'Ore fără tarif', 'Sesiuni deschise'],
        ...this.filteredEmployees.map(employee => [this.selected!.name, employee.name, employee.serie, employee.company, employee.hours,
          employee.cost, (employee.estimated_seconds / 3600).toFixed(2), (employee.missing_rate_seconds / 3600).toFixed(2), employee.open_sessions])];
    } else {
      rows = [['Cod', 'Șantier', 'Status', 'Ore', 'Manoperă RON', 'Alte costuri RON', 'Total perioadă RON', 'Total istoric RON', 'Buget RON', 'Buget rămas RON', 'Ore estimate', 'Ore fără tarif', 'Sesiuni deschise'],
        ...this.filteredSites.map(site => [site.code, site.name, this.statusLabel(site.status), site.costs.hours, site.costs.labor_cost,
          site.costs.expense_cost, site.costs.total_cost, site.lifetime_cost, site.budget, site.budget_remaining,
          (site.costs.estimated_seconds / 3600).toFixed(2), (site.costs.missing_rate_seconds / 3600).toFixed(2), site.costs.open_sessions])];
      const unallocated = this.data?.unallocated;
      if (unallocated) rows.push(['', 'Nealocat', '', unallocated.hours, unallocated.labor_cost, '0.00', unallocated.total_cost,
        this.data?.unallocated_lifetime.total_cost, '', '', (unallocated.estimated_seconds / 3600).toFixed(2),
        (unallocated.missing_rate_seconds / 3600).toFixed(2), unallocated.open_sessions]);
    }
    const escape = (value: unknown) => {
      let text = String(value ?? '');
      if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const csv = rows.map(row => row.map(escape).join(';')).join('\r\n');
    this.download(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
      `santiere-${this.selected?.code || 'toate'}-${this.appliedStart || 'inceput'}-${this.appliedEnd || 'prezent'}.csv`);
  }
  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    link.download = filename;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private errorText(error: any): string {
    const details = error?.error?.details;
    return [error?.error?.error || 'Nu s-au putut încărca sau salva datele. Încearcă din nou.',
      ...(details ? Object.entries(details).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(' ') : value}`) : [])].join(' ');
  }
}
