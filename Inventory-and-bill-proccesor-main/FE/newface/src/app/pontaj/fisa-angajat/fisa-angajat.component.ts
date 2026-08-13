import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SharedService } from '../../shared.service';

type SheetTab = 'general' | 'documents' | 'site' | 'ssm';
type DocumentCategory = 'personal' | 'employment';

interface EmployeeProfile {
  UserId?: number;
  UserName?: string | null;
  UserSerie?: string | null;
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
  prior_paid_leave_days?: number;
  leave_balance?: {
    total_accrued_days: string;
    total_used_days: number;
    remaining_days: string;
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

@Component({
  selector: 'app-fisa-angajat',
  templateUrl: './fisa-angajat.component.html',
  styleUrls: ['./fisa-angajat.component.css']
})
export class FisaAngajatComponent implements OnInit {
  userId: number | null = null;
  employeeDirectory: EmployeeProfile[] = [];
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
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    const parsedId = Number(rawId);

    if (!rawId || !Number.isFinite(parsedId)) {
      this.loadEmployeeDirectory();
      return;
    }

    this.userId = parsedId;
    this.loadEmployeeSheet(parsedId);
  }

  loadEmployeeDirectory(): void {
    this.loading = true;
    this.error = null;
    this.api.getUsrList().subscribe({
      next: users => {
        this.employeeDirectory = (users ?? []).slice().sort((a: EmployeeProfile, b: EmployeeProfile) =>
          String(a.UserName || '').localeCompare(String(b.UserName || ''), 'ro')
        );
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Nu pot încărca lista angajaților.';
      }
    });
  }

  openEmployeeSheet(employee: EmployeeProfile): void {
    if (employee.UserId) this.router.navigate(['/pontaj/fisa-angajat', employee.UserId]);
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

  goToTools(): void {
    this.router.navigate(['/unelte']);
  }

  editEmployee(): void {
    if (this.userId) {
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
