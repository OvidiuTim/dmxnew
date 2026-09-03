import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SharedService } from '../../shared.service';
import { AuthService } from '../../auth/auth.service';

type SheetTab = 'general' | 'documents' | 'site' | 'ssm';
type DocumentCategory = 'personal' | 'employment';

interface EmployeeProfile {
  UserId?: number;
  UserName?: string | null;
  UserSerie?: string | null;
  employment_status?: 'active' | 'dismissed' | string;
  dismissed_at?: string | null;
  uid?: string | null;
  hourly_rate?: string | number | null;
  Company?: string | null;
  equipment_size?: string | null;
  received_equipment?: boolean | null;
  phone_number?: string | null;
  photo?: string | null;
  trade?: string | null;
  hire_date?: string | null;
  effective_hire_date?: string | null;
  hire_date_source?: string | null;
  seniority_months?: number | null;
  ticket_benefit_enabled?: boolean;
  last_home_trip_date?: string | null;
  ticket_benefit_amount_eur?: string | number | null;
  next_eligibility_date?: string | null;
  is_currently_eligible?: boolean | null;
  days_until_eligible?: number | null;
  prior_paid_leave_days?: number;
  leave_balance?: {
    total_accrued_days: string;
    total_used_days: number;
    remaining_days: string;
    extra_days_taken: string;
  } | null;
  housing_location?: string | null;
  accommodation?: { id: number; name: string; address?: string } | null;
}

interface EmployeeDocumentType {
  id: number;
  name: string;
  category: DocumentCategory;
  category_label: string;
}

interface EmployeeDocument {
  id: number;
  document_type: EmployeeDocumentType;
  original_file_name: string;
  has_expiry: boolean;
  expiry_date: string | null;
  uploaded_at: string;
  download_url: string;
}

interface EmployeeTool {
  ToolId: number;
  ToolSerie?: string | null;
  ToolName: string;
  IsSSM?: boolean | null;
  Status?: string | null;
  StatusLabel?: string | null;
  Location?: string | null;
  MainLocation?: string | null;
  Detail?: string | null;
  AssignedUserName?: string | null;
  DateReceived?: string | null;
  DateOfGiving?: string | null;
  Pieces?: number | null;
  IsReturned?: boolean | null;
  IsLost?: boolean | null;
  DateReturned?: string | null;
  DateLost?: string | null;
}

type ExportField = { key: string; label: string };
type ExportGroup = { label: string; fields: ExportField[] };

const EMPLOYEE_EXPORT_GROUPS: ExportGroup[] = [
  { label: 'Identificare', fields: [
    { key: 'employee_id', label: 'ID angajat' }, { key: 'name', label: 'Nume' },
    { key: 'series', label: 'Serie angajat' }, { key: 'person_type', label: 'Categorie persoană' },
    { key: 'employment_status', label: 'Activ/demis' }, { key: 'dismissed_at', label: 'Data demiterii' },
  ]},
  { label: 'Contact și angajare', fields: [
    { key: 'company', label: 'Companie' }, { key: 'trade', label: 'Meserie' },
    { key: 'phone', label: 'Telefon' }, { key: 'email', label: 'E-mail' },
    { key: 'hire_date', label: 'Data angajării' }, { key: 'seniority', label: 'Vechime' },
  ]},
  { label: 'Acces în aplicație', fields: [
    { key: 'app_username', label: 'Utilizator aplicație' }, { key: 'app_account_active', label: 'Cont aplicație activ' },
    { key: 'is_storekeeper', label: 'Magazioner' }, { key: 'app_modules', label: 'Module permise' },
    { key: 'page_permissions', label: 'Pagini permise' },
  ]},
  { label: 'Salarizare', fields: [
    { key: 'hourly_rate', label: 'Tarif orar (RON)' }, { key: 'total_salary_ron', label: 'Salariu total (RON)' },
    { key: 'salary_advance_ron', label: 'Avans (RON)' }, { key: 'salary_remainder_ron', label: 'Rest (RON)' },
    { key: 'meal_vouchers_ron', label: 'Bonuri de masă (RON)' }, { key: 'net_salary_eur', label: 'Salariu net (EUR)' },
    { key: 'net_salary_ron', label: 'Salariu net profil (RON)' }, { key: 'food_money_enabled', label: 'Bani de mâncare activați' },
    { key: 'food_money_ron', label: 'Bani de mâncare (RON)' },
  ]},
  { label: 'Concedii', fields: [
    { key: 'leave_accrued', label: 'Zile acumulate' }, { key: 'leave_used', label: 'Zile folosite' },
    { key: 'leave_remaining', label: 'Zile rămase' }, { key: 'leave_extra', label: 'Zile suplimentare luate' },
    { key: 'leave_requests', label: 'Cereri de concediu (sheet separat)' },
  ]},
  { label: 'Ajutor bilet acasă', fields: [
    { key: 'ticket_enabled', label: 'Eligibil pentru ajutor' }, { key: 'ticket_already_used', label: 'A beneficiat deja' },
    { key: 'last_home_trip', label: 'Data ultimei plecări' }, { key: 'next_ticket_eligibility', label: 'Următoarea eligibilitate' },
    { key: 'ticket_amount_eur', label: 'Sumă maximă (EUR)' },
  ]},
  { label: 'Cazare', fields: [
    { key: 'accommodation', label: 'Cazare' }, { key: 'accommodation_address', label: 'Adresă cazare' },
    { key: 'accommodation_room', label: 'Cameră' },
  ]},
  { label: 'Echipament personal', fields: [
    { key: 'equipment_received', label: 'A primit echipament' }, { key: 'equipment_size', label: 'Mărime echipament' },
  ]},
  { label: 'Scule', fields: [{ key: 'tools', label: 'Scule atribuite (sheet separat)' }] },
  { label: 'Documente', fields: [{ key: 'documents', label: 'Documente (sheet separat)' }] },
  { label: 'Echipe', fields: [
    { key: 'team', label: 'Echipă' }, { key: 'team_role', label: 'Rol în echipă' },
    { key: 'team_records', label: 'Apartenențe și roluri (sheet separat)' },
    { key: 'transfer_requests', label: 'Cereri transfer (sheet separat)' },
  ]},
  { label: 'Organigramă', fields: [
    { key: 'organization_department', label: 'Departament' }, { key: 'organization_role', label: 'Funcție' },
    { key: 'organization_manager', label: 'Superior direct' },
  ]},
];

const DEFAULT_EMPLOYEE_EXPORT_FIELDS = [
  'employee_id', 'name', 'series', 'company', 'trade', 'phone', 'email', 'employment_status',
  'hire_date', 'seniority', 'total_salary_ron', 'leave_remaining', 'ticket_enabled',
  'ticket_already_used', 'last_home_trip', 'next_ticket_eligibility', 'accommodation', 'team',
];

@Component({
  selector: 'app-fisa-angajat',
  templateUrl: './fisa-angajat.component.html',
  styleUrls: ['./fisa-angajat.component.css']
})
export class FisaAngajatComponent implements OnInit {
  readonly exportGroups = EMPLOYEE_EXPORT_GROUPS;
  userId: number | null = null;
  employeeDirectory: EmployeeProfile[] = [];
  directorySearch = '';
  private directorySearchTimer: ReturnType<typeof setTimeout> | null = null;
  private directoryRequestId = 0;
  employee: EmployeeProfile | null = null;
  siteTools: EmployeeTool[] = [];
  ssmTools: EmployeeTool[] = [];
  documents: EmployeeDocument[] = [];
  documentTypes: EmployeeDocumentType[] = [];

  activeTab: SheetTab = 'general';
  dropdownOpen = false;
  openToolMenuId: number | null = null;

  loading = false;
  error: string | null = null;
  documentError: string | null = null;
  documentNotice: string | null = null;
  uploadingDocument = false;
  canExportEmployees = false;
  exportModalOpen = false;
  exportingEmployees = false;
  exportError = '';
  selectedExportFields = new Set<string>();
  selectedDocumentFile: File | null = null;
  selectedDocumentFileName = '';
  documentForm: {
    category: DocumentCategory;
    document_type_id: number | null;
    document_type_name: string;
    has_expiry: boolean;
    expiry_date: string;
  } = this.emptyDocumentForm();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: SharedService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    const session = this.auth.currentSession();
    this.canExportEmployees = !!session && (session.role === 'admin' || session.auth_type === 'legacy');
    const rawId = this.route.snapshot.paramMap.get('id');
    const parsedId = Number(rawId);

    if (!rawId || !Number.isFinite(parsedId)) {
      this.loadEmployeeDirectory();
      return;
    }

    this.userId = parsedId;
    this.loadEmployeeSheet(parsedId);
  }

  openEmployeeExport(): void {
    if (!this.canExportEmployees) return;
    this.selectedExportFields = new Set(DEFAULT_EMPLOYEE_EXPORT_FIELDS);
    this.exportError = '';
    this.exportModalOpen = true;
  }

  closeEmployeeExport(): void {
    if (!this.exportingEmployees) this.exportModalOpen = false;
  }

  isExportFieldSelected(key: string): boolean {
    return this.selectedExportFields.has(key);
  }

  toggleExportField(key: string, checked: boolean): void {
    checked ? this.selectedExportFields.add(key) : this.selectedExportFields.delete(key);
    this.selectedExportFields = new Set(this.selectedExportFields);
    this.exportError = '';
  }

  selectAllExportFields(): void {
    this.selectedExportFields = new Set(this.exportGroups.flatMap(group => group.fields.map(field => field.key)));
    this.exportError = '';
  }

  deselectAllExportFields(): void {
    this.selectedExportFields = new Set();
    this.exportError = '';
  }

  generateEmployeeExport(): void {
    const fields = Array.from(this.selectedExportFields);
    if (!fields.length) {
      this.exportError = 'Selectează cel puțin un câmp pentru export.';
      return;
    }
    this.exportingEmployees = true;
    this.exportError = '';
    this.api.exportEmployees(fields).subscribe({
      next: response => {
        this.exportingEmployees = false;
        this.downloadResponse(response, `angajati_${this.todayFileDate()}.xlsx`);
        this.exportModalOpen = false;
      },
      error: error => {
        this.exportingEmployees = false;
        this.exportError = error?.error?.error || 'Fișierul Excel nu a putut fi generat.';
      },
    });
  }

  loadEmployeeDirectory(query = this.directorySearch): void {
    const requestId = ++this.directoryRequestId;
    this.loading = true;
    this.error = null;
    this.api.getUsrList({ q: query, person_type: 'employee' }).subscribe({
      next: users => {
        if (requestId !== this.directoryRequestId) return;
        this.employeeDirectory = (users ?? [])
          .filter((user: any) => (user.person_type || 'employee') === 'employee')
          .slice().sort((a: EmployeeProfile, b: EmployeeProfile) =>
          String(a.UserName || '').localeCompare(String(b.UserName || ''), 'ro')
        );
        this.loading = false;
      },
      error: () => {
        if (requestId !== this.directoryRequestId) return;
        this.loading = false;
        this.error = 'Nu pot încărca lista angajaților.';
      }
    });
  }

  onDirectorySearch(value: string): void {
    this.directorySearch = value;
    if (this.directorySearchTimer) clearTimeout(this.directorySearchTimer);
    this.directorySearchTimer = setTimeout(() => this.loadEmployeeDirectory(value), 180);
  }

  openEmployeeSheet(employee: EmployeeProfile): void {
    if (employee.UserId) this.router.navigate(['/pontaj/fisa-angajat', employee.UserId]);
  }

  openAttendanceHistory(employee: EmployeeProfile): void {
    if (employee.UserId) this.router.navigate(['/user', employee.UserId]);
  }

  get activeEmployeeDirectory(): EmployeeProfile[] {
    return this.employeeDirectory.filter(employee => employee.employment_status !== 'dismissed');
  }

  get dismissedEmployeeDirectory(): EmployeeProfile[] {
    return this.employeeDirectory.filter(employee => employee.employment_status === 'dismissed');
  }

  get isEmployeeDismissed(): boolean {
    return this.employee?.employment_status === 'dismissed';
  }

  get currentTools(): EmployeeTool[] {
    return this.activeTab === 'site' ? this.siteTools : this.ssmTools;
  }

  get currentTitle(): string {
    return this.activeTab === 'site' ? 'Scule santier' : 'Scule SSM';
  }

  get currentSummaryTitle(): string {
    return 'Sumar scule angajat';
  }

  get hourlyRateLabel(): string {
    const raw = this.employee?.hourly_rate ?? '0';
    const rate = Number(String(raw).replace(',', '.'));
    return Number.isFinite(rate) && rate > 0 ? `${rate.toFixed(2)} lei / ora` : '-';
  }

  get seniorityLabel(): string {
    const months = Number(this.employee?.seniority_months || 0);
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (!years) return `${remainingMonths} luni`;
    if (!remainingMonths) return `${years} ${years === 1 ? 'an' : 'ani'}`;
    return `${years} ${years === 1 ? 'an' : 'ani'} și ${remainingMonths} luni`;
  }

  get inWorkCount(): number {
    return this.currentTools
      .filter(tool => this.normalizeStatus(tool.Status) === 'in_lucru' && !tool.IsReturned && !tool.IsLost)
      .reduce((total, tool) => total + this.piecesCount(tool), 0);
  }

  get returnedCount(): number {
    return this.currentTools
      .filter(tool => !!tool.IsReturned)
      .reduce((total, tool) => total + this.piecesCount(tool), 0);
  }

  get lostCount(): number {
    return this.currentTools
      .filter(tool => !!tool.IsLost)
      .reduce((total, tool) => total + this.piecesCount(tool), 0);
  }

  get totalCount(): number {
    return this.currentTools.reduce((total, tool) => total + this.piecesCount(tool), 0);
  }

  get profileInitials(): string {
    const name = (this.employee?.UserName ?? '').trim();
    if (!name) {
      return '--';
    }

    return name
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  loadEmployeeSheet(userId: number): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      employee: this.api.getUser(userId),
      siteTools: this.api.getEmployeeTools(userId, false),
      ssmTools: this.api.getEmployeeTools(userId, true),
      documents: this.api.getEmployeeDocuments(userId),
      documentTypes: this.api.getEmployeeDocumentTypes(),
    }).subscribe({
      next: ({ employee, siteTools, ssmTools, documents, documentTypes }) => {
        if (employee?.employment_status === 'dismissed') {
          this.loading = false;
          this.router.navigate(['/user', userId]);
          return;
        }
        this.employee = employee ?? null;
        this.siteTools = (siteTools ?? []) as EmployeeTool[];
        this.ssmTools = (ssmTools ?? []) as EmployeeTool[];
        this.documents = documents?.documents ?? [];
        this.documentTypes = documentTypes?.types ?? [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Nu pot incarca fisa angajatului', err);
        this.error = 'Nu pot incarca fisa angajatului.';
        this.loading = false;
      }
    });
  }

  setTab(tab: SheetTab): void {
    this.activeTab = tab;
    this.openToolMenuId = null;
  }

  documentTypesFor(category: DocumentCategory): EmployeeDocumentType[] {
    return this.documentTypes.filter(item => item.category === category);
  }

  documentsFor(category: DocumentCategory): EmployeeDocument[] {
    return this.documents.filter(item => item.document_type.category === category);
  }

  onDocumentTypeChange(value: string): void {
    this.documentForm.document_type_id = value ? Number(value) : null;
    if (this.documentForm.document_type_id) this.documentForm.document_type_name = '';
  }

  onNewDocumentType(value: string): void {
    this.documentForm.document_type_name = value;
    if (value.trim()) this.documentForm.document_type_id = null;
  }

  onDocumentFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedDocumentFile = input.files?.[0] ?? null;
    this.selectedDocumentFileName = this.selectedDocumentFile?.name ?? '';
  }

  uploadDocument(): void {
    if (!this.userId || !this.selectedDocumentFile) {
      this.documentError = 'Selectează scanarea documentului.';
      return;
    }
    if (!this.documentForm.document_type_id && !this.documentForm.document_type_name.trim()) {
      this.documentError = 'Selectează sau creează tipul documentului.';
      return;
    }
    if (this.documentForm.has_expiry && !this.documentForm.expiry_date) {
      this.documentError = 'Completează data expirării.';
      return;
    }
    const payload = new FormData();
    payload.append('file', this.selectedDocumentFile);
    payload.append('category', this.documentForm.category);
    payload.append('has_expiry', String(this.documentForm.has_expiry));
    if (this.documentForm.document_type_id) payload.append('document_type_id', String(this.documentForm.document_type_id));
    if (this.documentForm.document_type_name.trim()) payload.append('document_type_name', this.documentForm.document_type_name.trim());
    if (this.documentForm.has_expiry) payload.append('expiry_date', this.documentForm.expiry_date);

    this.uploadingDocument = true;
    this.documentError = null;
    this.documentNotice = null;
    this.api.uploadEmployeeDocument(this.userId, payload).subscribe({
      next: response => {
        this.uploadingDocument = false;
        this.documents = [...this.documents, response.document];
        const type = response.document?.document_type as EmployeeDocumentType | undefined;
        if (type && !this.documentTypes.some(item => item.id === type.id)) this.documentTypes = [...this.documentTypes, type];
        this.documentForm = this.emptyDocumentForm();
        this.selectedDocumentFile = null;
        this.selectedDocumentFileName = '';
        this.documentNotice = 'Documentul a fost încărcat.';
      },
      error: error => {
        this.uploadingDocument = false;
        this.documentError = error?.error?.details
          ? Object.values(error.error.details).flat().join(' ')
          : error?.error?.error || 'Documentul nu a putut fi încărcat.';
      },
    });
  }

  deleteDocument(document: EmployeeDocument): void {
    if (!confirm(`Ștergi documentul „${document.document_type.name}”?`)) return;
    this.api.deleteEmployeeDocument(document.id).subscribe({
      next: () => {
        this.documents = this.documents.filter(item => item.id !== document.id);
        this.documentNotice = 'Documentul a fost șters.';
      },
      error: error => { this.documentError = error?.error?.error || 'Documentul nu a putut fi șters.'; },
    });
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
    this.openToolMenuId = null;
  }

  toggleToolMenu(toolId: number): void {
    this.openToolMenuId = this.openToolMenuId === toolId ? null : toolId;
    this.dropdownOpen = false;
  }

  goBack(): void {
    this.router.navigate(['/pontaj']);
  }

  addEmployee(): void {
    this.router.navigate(['/users/new']);
  }

  goToTools(): void {
    this.router.navigate(['/unelte']);
  }

  editEmployee(): void {
    if (this.userId && !this.isEmployeeDismissed) {
      this.router.navigate(['/users', this.userId, 'edit']);
    }
  }

  statusLabel(status: string | null | undefined): string {
    const normalized = this.normalizeStatus(status);
    const labels: Record<string, string> = {
      functionala: 'Funcțional',
      nefunctionala: 'Nefuncțional',
      in_lucru: 'În lucru',
    };
    return labels[normalized] ?? 'În lucru';
  }

  statusClass(status: string | null | undefined): string {
    return `tool-status ${this.normalizeStatus(status)}`;
  }

  possessionLabel(tool: EmployeeTool): string {
    if (tool.IsLost) {
      return `Pierduta${tool.DateLost ? ` la ${this.formatDate(tool.DateLost)}` : ''}`;
    }

    if (tool.IsReturned) {
      return `Returnata${tool.DateReturned ? ` la ${this.formatDate(tool.DateReturned)}` : ''}`;
    }

    return 'La angajat';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString('ro-RO');
  }

  displayText(value: string | number | null | undefined): string {
    const normalized = String(value ?? '').trim();
    return normalized || '-';
  }

  displayBoolean(value: boolean | null | undefined): string {
    if (value === true) {
      return 'Da';
    }
    if (value === false) {
      return 'Nu';
    }
    return '-';
  }

  trackByTool(_: number, tool: EmployeeTool): number {
    return tool.ToolId;
  }

  trackByDocument(_: number, document: EmployeeDocument): number {
    return document.id;
  }

  piecesCount(tool: Pick<EmployeeTool, 'Pieces'> | null | undefined): number {
    if (tool?.Pieces === null || tool?.Pieces === undefined) {
      return 1;
    }
    const pieces = Number(tool.Pieces);
    return Number.isFinite(pieces) ? Math.max(0, Math.floor(pieces)) : 1;
  }

  private downloadResponse(response: any, fallbackName: string): void {
    const blob = response?.body as Blob | null;
    if (!blob) return;
    const disposition = String(response?.headers?.get('content-disposition') || '');
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = match?.[1] || fallbackName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private todayFileDate(): string {
    const today = new Date();
    return [
      String(today.getDate()).padStart(2, '0'),
      String(today.getMonth() + 1).padStart(2, '0'),
      today.getFullYear(),
    ].join('-');
  }

  private normalizeStatus(status: string | null | undefined): string {
    const normalized = String(status ?? '').trim().toLowerCase().replace(/\s+/g, '_');
    if (normalized === 'functionala' || normalized === 'nefunctionala' || normalized === 'in_lucru') {
      return normalized;
    }
    if (normalized === 'magazie') return 'functionala';
    if (normalized === 'stricata') return 'nefunctionala';
    return 'in_lucru';
  }

  private emptyDocumentForm() {
    return {
      category: 'personal' as DocumentCategory,
      document_type_id: null as number | null,
      document_type_name: '',
      has_expiry: false,
      expiry_date: '',
    };
  }
}
