import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SharedService } from 'src/app/shared.service';

type ToolStatus = 'stricata' | 'in_lucru' | 'magazie';
type CategoryFilter = 'ALL' | 'SITE' | 'SSM';
type StatusFilter = 'ALL' | ToolStatus;

interface EmployeeOption {
  UserId: number;
  UserName: string;
}

interface ToolItem {
  ToolId: number;
  ToolSerie?: string | null;
  ToolName: string;
  User?: string | null;
  IsSSM?: boolean | null;
  Status?: ToolStatus | string | null;
  StatusLabel?: string | null;
  Location?: string | null;
  MainLocation?: string | null;
  Detail?: string | null;
  AssignedUserId?: number | null;
  AssignedUserName?: string | null;
  DateReceived?: string | null;
  DateOfGiving?: string | null;
  IsReturned?: boolean | null;
  IsLost?: boolean | null;
  DateReturned?: string | null;
  DateLost?: string | null;
  Pieces?: number | null;
}

interface ToolForm {
  ToolId: number | null;
  ToolSerie: string;
  ToolName: string;
  IsSSM: boolean;
  Status: ToolStatus;
  Location: string;
  Detail: string;
  AssignedUserId: number | null;
  Pieces: number;
  DateReceived: string;
  IsReturned: boolean;
  DateReturned: string;
  IsLost: boolean;
  DateLost: string;
}

@Component({
  selector: 'app-unelte',
  templateUrl: './unelte.component.html',
  styleUrls: ['./unelte.component.css']
})
export class UnelteComponent implements OnInit {
  tools: ToolItem[] = [];
  users: EmployeeOption[] = [];

  loading = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;

  searchTerm = '';
  categoryFilter: CategoryFilter = 'ALL';
  statusFilter: StatusFilter = 'ALL';

  readonly statuses: Array<{ value: ToolStatus; label: string }> = [
    { value: 'in_lucru', label: 'In lucru' },
    { value: 'magazie', label: 'In magazie' },
    { value: 'stricata', label: 'Stricata' },
  ];

  toolForm: ToolForm = this.emptyForm();

  constructor(private router: Router, private service: SharedService) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  seeMagazie(): void { this.router.navigateByUrl('/magazie'); }
  seeUnelte(): void { this.router.navigateByUrl('/unelte'); }
  seeAdaugaUnealta(): void { this.router.navigateByUrl('/unelte/adauga-unealta'); }
  seePredareUnealta(): void { this.router.navigateByUrl('/predare-unealta'); }

  get isEditing(): boolean {
    return this.toolForm.ToolId !== null;
  }

  get filteredTools(): ToolItem[] {
    const search = this.normalize(this.searchTerm);

    return this.tools.filter((tool) => {
      const matchesSearch = !search || [
        tool.ToolName,
        tool.ToolSerie,
        tool.Location,
        tool.MainLocation,
        tool.AssignedUserName,
        tool.Detail,
      ].some(value => this.normalize(value).includes(search));

      const matchesCategory =
        this.categoryFilter === 'ALL'
        || (this.categoryFilter === 'SSM' && !!tool.IsSSM)
        || (this.categoryFilter === 'SITE' && !tool.IsSSM);

      const matchesStatus = this.statusFilter === 'ALL' || tool.Status === this.statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }

  get totalSiteTools(): number {
    return this.tools
      .filter(tool => !tool.IsSSM)
      .reduce((total, tool) => total + this.piecesCount(tool), 0);
  }

  get totalSsmTools(): number {
    return this.tools
      .filter(tool => !!tool.IsSSM)
      .reduce((total, tool) => total + this.piecesCount(tool), 0);
  }

  get totalToolPieces(): number {
    return this.tools.reduce((total, tool) => total + this.piecesCount(tool), 0);
  }

  loadInitialData(): void {
    this.loading = true;
    this.error = null;

    this.service.getUsrList().subscribe({
      next: (users) => {
        this.users = (users ?? [])
          .map(user => ({ UserId: Number(user.UserId), UserName: String(user.UserName ?? '') }))
          .filter(user => Number.isFinite(user.UserId) && !!user.UserName)
          .sort((a, b) => a.UserName.localeCompare(b.UserName, 'ro'));

        this.refreshToolList();
      },
      error: () => {
        this.users = [];
        this.refreshToolList();
      }
    });
  }

  refreshToolList(): void {
    this.loading = true;
    this.service.getTolList().subscribe({
      next: (tools) => {
        this.tools = (tools ?? []) as ToolItem[];
        this.loading = false;
      },
      error: (err) => {
        console.error('Nu pot incarca uneltele', err);
        this.error = 'Nu pot incarca lista de unelte.';
        this.loading = false;
      }
    });
  }

  saveTool(): void {
    this.error = null;
    this.success = null;

    if (!this.isEditing) {
      return;
    }

    if (!this.toolForm.ToolName.trim()) {
      this.error = 'Completeaza numele uneltei.';
      return;
    }

    if (!Number.isFinite(Number(this.toolForm.Pieces)) || Number(this.toolForm.Pieces) < 1) {
      this.error = 'Numarul de bucati trebuie sa fie cel putin 1.';
      return;
    }

    this.saving = true;
    const payload = this.buildPayload();
    const request = this.service.updateTool(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.success = 'Unealta a fost actualizata.';
        this.cancelEdit();
        this.refreshToolList();
      },
      error: (err) => {
        console.error('Nu pot salva unealta', err);
        this.saving = false;
        this.error = err?.error?.details
          ? `Nu pot salva unealta: ${JSON.stringify(err.error.details)}`
          : 'Nu pot salva unealta acum.';
      }
    });
  }

  editTool(tool: ToolItem): void {
    this.error = null;
    this.success = null;
    this.toolForm = {
      ToolId: tool.ToolId,
      ToolSerie: tool.ToolSerie ?? '',
      ToolName: tool.ToolName ?? '',
      IsSSM: !!tool.IsSSM,
      Status: this.normalizeStatus(tool.Status),
      Location: tool.Location ?? tool.MainLocation ?? '',
      Detail: tool.Detail ?? '',
      AssignedUserId: tool.AssignedUserId ?? null,
      Pieces: this.piecesCount(tool),
      DateReceived: tool.DateReceived ?? tool.DateOfGiving ?? '',
      IsReturned: !!tool.IsReturned,
      DateReturned: tool.DateReturned ?? '',
      IsLost: !!tool.IsLost,
      DateLost: tool.DateLost ?? '',
    };
  }

  cancelEdit(): void {
    this.toolForm = this.emptyForm();
  }

  deleteClick(tool: ToolItem): void {
    if (!confirm(`Stergi unealta "${tool.ToolName}"?`)) {
      return;
    }

    this.service.deleteTool(tool.ToolId).subscribe({
      next: () => {
        this.success = 'Unealta a fost stearsa.';
        this.refreshToolList();
      },
      error: (err) => {
        console.error('Nu pot sterge unealta', err);
        this.error = err?.error?.message || err?.error?.error || 'Unealta nu a putut fi stearsa.';
      }
    });
  }

  trackByTool(_: number, tool: ToolItem): number {
    return tool.ToolId;
  }

  statusLabel(status: string | null | undefined): string {
    return this.statuses.find(item => item.value === status)?.label ?? 'In lucru';
  }

  possessionLabel(tool: ToolItem): string {
    if (tool.IsLost) {
      return `Pierduta${tool.DateLost ? ` (${this.formatDate(tool.DateLost)})` : ''}`;
    }

    if (tool.IsReturned) {
      return `Returnata${tool.DateReturned ? ` (${this.formatDate(tool.DateReturned)})` : ''}`;
    }

    return 'La angajat / in lucru';
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

  onReturnedChange(value: boolean): void {
    this.toolForm.IsReturned = value;
    if (value) {
      this.toolForm.IsLost = false;
      this.toolForm.DateLost = '';
      if (!this.toolForm.DateReturned) {
        this.toolForm.DateReturned = this.todayISO();
      }
      if (this.toolForm.Status === 'in_lucru') {
        this.toolForm.Status = 'magazie';
      }
    }
  }

  onLostChange(value: boolean): void {
    this.toolForm.IsLost = value;
    if (value) {
      this.toolForm.IsReturned = false;
      this.toolForm.DateReturned = '';
      if (!this.toolForm.DateLost) {
        this.toolForm.DateLost = this.todayISO();
      }
      this.toolForm.Status = 'stricata';
    }
  }

  private buildPayload(): any {
    const assignedUser = this.users.find(user => user.UserId === this.toolForm.AssignedUserId);
    const location = this.toolForm.Location.trim()
      || (assignedUser ? assignedUser.UserName : '')
      || (this.toolForm.Status === 'magazie' ? 'Magazie' : '');

    return {
      ...(this.toolForm.ToolId ? { ToolId: this.toolForm.ToolId } : {}),
      ToolSerie: this.normalizeOptional(this.toolForm.ToolSerie),
      ToolName: this.toolForm.ToolName.trim(),
      IsSSM: this.toolForm.IsSSM,
      Status: this.toolForm.Status,
      Location: this.normalizeOptional(location),
      MainLocation: this.normalizeOptional(location),
      Detail: this.normalizeOptional(this.toolForm.Detail),
      AssignedUserId: this.toolForm.AssignedUserId,
      DateReceived: this.normalizeOptional(this.toolForm.DateReceived),
      DateOfGiving: this.normalizeOptional(this.toolForm.DateReceived),
      IsReturned: this.toolForm.IsReturned,
      DateReturned: this.toolForm.IsReturned ? this.normalizeOptional(this.toolForm.DateReturned) : null,
      IsLost: this.toolForm.IsLost,
      DateLost: this.toolForm.IsLost ? this.normalizeOptional(this.toolForm.DateLost) : null,
      Pieces: Math.max(1, Math.floor(Number(this.toolForm.Pieces) || 1)),
    };
  }

  private emptyForm(): ToolForm {
    return {
      ToolId: null,
      ToolSerie: '',
      ToolName: '',
      IsSSM: false,
      Status: 'in_lucru',
      Location: '',
      Detail: '',
      AssignedUserId: null,
      Pieces: 1,
      DateReceived: this.todayISO(),
      IsReturned: false,
      DateReturned: '',
      IsLost: false,
      DateLost: '',
    };
  }

  private normalizeStatus(status: string | null | undefined): ToolStatus {
    if (status === 'stricata' || status === 'magazie' || status === 'in_lucru') {
      return status;
    }
    return 'in_lucru';
  }

  piecesCount(tool: Pick<ToolItem, 'Pieces'> | null | undefined): number {
    const pieces = Number(tool?.Pieces ?? 1);
    return Number.isFinite(pieces) && pieces > 0 ? Math.floor(pieces) : 1;
  }

  private normalizeOptional(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim();
    return normalized ? normalized : null;
  }

  private normalize(value: string | number | null | undefined): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private todayISO(): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }
}
