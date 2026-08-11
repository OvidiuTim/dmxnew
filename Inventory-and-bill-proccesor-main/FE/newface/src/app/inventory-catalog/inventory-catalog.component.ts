import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SharedService } from '../shared.service';

type ToolRecord = {
  ToolId: number;
  ToolName: string;
  ToolSerie?: string | null;
  DisplaySerie?: string | null;
  Category?: string | null;
  Brand?: string | null;
  Model?: string | null;
  SerialNumber?: string | null;
  MainLocation?: string | null;
  Location?: string | null;
  AssignedUserName?: string | null;
  AssignedUserId?: number | null;
  AssignedTeamId?: number | null;
  AssignedTeamName?: string | null;
  User?: string | null;
  Pieces?: number | null;
  IsSSM: boolean;
  Status?: string | null;
  StatusLabel?: string | null;
  RequiresVerification?: boolean;
  ExpiryDate?: string | null;
  SourceStatus?: string | null;
  IsReturned?: boolean;
  IsLost?: boolean;
};

type TeamToolGroup = {
  id: number | string;
  name: string;
  tools: ToolRecord[];
  pieces: number;
};

type EmployeeRecord = {
  UserId: number;
  UserName: string;
  UserSerie?: string | null;
  trade?: string | null;
  Company?: string | null;
  active?: boolean;
};

type SsmEquipmentKey = 'helmet' | 'boots' | 'vest' | 'harness' | 'gloves';
type SsmEquipmentCell = {
  label: string;
  tools: ToolRecord[];
  present: boolean;
  expired: boolean;
};
type SsmEmployeeRow = {
  employee: EmployeeRecord;
  equipment: Record<SsmEquipmentKey, SsmEquipmentCell>;
  complete: boolean;
  expiredLabels: string[];
};

@Component({
  selector: 'app-inventory-catalog',
  templateUrl: './inventory-catalog.component.html',
  styleUrls: ['./inventory-catalog.component.css']
})
export class InventoryCatalogComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  isSsm = false;
  title = 'Scule';
  description = 'Inventarul operațional al sculelor de șantier.';
  tools: ToolRecord[] = [];
  employees: EmployeeRecord[] = [];
  loading = true;
  error = '';
  searchTerm = '';
  categoryFilter = 'ALL';
  statusFilter = 'ALL';
  locationFilter = 'ALL';
  ssmStatusFilter = 'ALL';
  page = 1;
  readonly pageSize = 10;

  constructor(
    private readonly service: SharedService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.route.data.pipe(takeUntil(this.destroy$)).subscribe(data => {
      this.isSsm = Boolean(data['isSsm']);
      this.title = String(data['title'] || (this.isSsm ? 'Echipamente SSM' : 'Scule'));
      this.description = String(data['description'] || 'Inventar operațional.');
      this.resetFilters();
      this.loadTools();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTools(): void {
    this.loading = true;
    this.error = '';
    const request = this.isSsm
      ? forkJoin({
          tools: this.service.getTolList({ is_ssm: true }),
          employees: this.service.getUsrList(),
        })
      : forkJoin({
          tools: this.service.getTolList({ is_ssm: false }),
          employees: of([] as any[]),
        });

    request.subscribe({
      next: data => {
        this.tools = Array.isArray(data.tools) ? data.tools as ToolRecord[] : [];
        this.employees = (Array.isArray(data.employees) ? data.employees : [])
          .map(employee => ({
            UserId: Number(employee.UserId),
            UserName: String(employee.UserName || ''),
            UserSerie: employee.UserSerie ?? null,
            trade: employee.trade ?? null,
            Company: employee.Company ?? null,
            active: employee.active !== false,
          }))
          .filter(employee => Number.isFinite(employee.UserId) && Boolean(employee.UserName))
          .sort((a, b) => a.UserName.localeCompare(b.UserName, 'ro'));
        this.loading = false;
        this.ensureValidPage();
      },
      error: () => {
        this.tools = [];
        this.employees = [];
        this.loading = false;
        this.error = `Nu am putut încărca ${this.isSsm ? 'echipamentele SSM' : 'sculele'}. Încearcă din nou.`;
      }
    });
  }

  get categories(): string[] {
    return this.unique(this.tools.map(tool => tool.Category));
  }

  get locations(): string[] {
    return this.unique(this.tools.map(tool => this.locationOf(tool)));
  }

  get totalPieces(): number {
    return this.tools.reduce((total, tool) => total + this.piecesOf(tool), 0);
  }

  get assignedPieces(): number {
    return this.tools.filter(tool => this.isAssigned(tool)).reduce((total, tool) => total + this.piecesOf(tool), 0);
  }

  get warehousePieces(): number {
    return this.tools.filter(tool => !this.isAssigned(tool) && tool.Status === 'functionala').reduce((total, tool) => total + this.piecesOf(tool), 0);
  }

  get attentionCount(): number {
    return this.isSsm
      ? this.tools.filter(tool => Boolean(tool.RequiresVerification)).length
      : this.tools.filter(tool => tool.Status === 'nefunctionala').reduce((total, tool) => total + this.piecesOf(tool), 0);
  }

  get teamToolGroups(): TeamToolGroup[] {
    const groups = new Map<number | string, TeamToolGroup>();
    this.tools
      .filter(tool => !tool.IsSSM && Boolean(tool.AssignedTeamName) && this.isAssigned(tool))
      .forEach(tool => {
        const name = String(tool.AssignedTeamName).trim();
        const id = tool.AssignedTeamId ?? name;
        const group = groups.get(id) ?? { id, name, tools: [], pieces: 0 };
        group.tools.push(tool);
        group.pieces += this.piecesOf(tool);
        groups.set(id, group);
      });

    return [...groups.values()]
      .map(group => ({
        ...group,
        tools: [...group.tools].sort((a, b) => a.ToolName.localeCompare(b.ToolName, 'ro')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }

  get ssmRows(): SsmEmployeeRow[] {
    return this.employees.map(employee => {
      const assigned = this.tools.filter(tool => this.isActiveAssignmentFor(tool, employee));
      const equipment = {
        helmet: this.ssmCell('Cască', assigned, 'helmet'),
        boots: this.ssmCell('Bocanci', assigned, 'boots'),
        vest: this.ssmCell('Vestă', assigned, 'vest'),
        harness: this.ssmCell('Ham', assigned, 'harness'),
        gloves: this.ssmCell('Mănuși', assigned, 'gloves'),
      };
      const cells = Object.values(equipment);
      return {
        employee,
        equipment,
        complete: cells.every(cell => cell.present),
        expiredLabels: cells.filter(cell => cell.expired).map(cell => cell.label),
      };
    });
  }

  get filteredSsmRows(): SsmEmployeeRow[] {
    const query = this.normalize(this.searchTerm);
    return this.ssmRows.filter(row => {
      const matchesSearch = !query || [
        row.employee.UserName,
        row.employee.UserSerie,
        row.employee.trade,
        row.employee.Company,
      ].map(value => this.normalize(value)).join(' ').includes(query);
      const matchesStatus = this.ssmStatusFilter === 'ALL'
        || (this.ssmStatusFilter === 'complete' && row.complete)
        || (this.ssmStatusFilter === 'incomplete' && !row.complete)
        || (this.ssmStatusFilter === 'expired' && row.expiredLabels.length > 0);
      return matchesSearch && matchesStatus;
    });
  }

  get pagedSsmRows(): SsmEmployeeRow[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredSsmRows.slice(start, start + this.pageSize);
  }

  get completeSsmEmployees(): number {
    return this.ssmRows.filter(row => row.complete).length;
  }

  get incompleteSsmEmployees(): number {
    return this.ssmRows.filter(row => !row.complete).length;
  }

  get expiredSsmEmployees(): number {
    return this.ssmRows.filter(row => row.expiredLabels.length > 0).length;
  }

  get filteredTools(): ToolRecord[] {
    const query = this.normalize(this.searchTerm);
    return this.tools.filter(tool => {
      const searchable = [
        tool.ToolName, tool.ToolSerie, tool.DisplaySerie, tool.Category, tool.Brand,
        tool.Model, tool.SerialNumber, this.locationOf(tool), this.employeeOf(tool), tool.AssignedTeamName
      ].map(value => this.normalize(value)).join(' ');
      return (!query || searchable.includes(query))
        && (this.categoryFilter === 'ALL' || tool.Category === this.categoryFilter)
        && (this.statusFilter === 'ALL' || tool.Status === this.statusFilter)
        && (this.locationFilter === 'ALL' || this.locationOf(tool) === this.locationFilter);
    });
  }

  get pagedTools(): ToolRecord[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredTools.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    const itemCount = this.isSsm ? this.filteredSsmRows.length : this.filteredTools.length;
    return Math.max(1, Math.ceil(itemCount / this.pageSize));
  }

  get firstVisible(): number {
    const itemCount = this.isSsm ? this.filteredSsmRows.length : this.filteredTools.length;
    return itemCount ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get lastVisible(): number {
    const itemCount = this.isSsm ? this.filteredSsmRows.length : this.filteredTools.length;
    return Math.min(this.page * this.pageSize, itemCount);
  }

  filtersChanged(): void {
    this.page = 1;
  }

  clearFilters(): void {
    this.resetFilters();
  }

  openEmployeeEquipment(employeeId: number): void {
    this.router.navigate(['/predare-unealta'], { queryParams: { user_id: employeeId } });
  }

  changePage(nextPage: number): void {
    this.page = Math.min(Math.max(nextPage, 1), this.totalPages);
  }

  openLegacy(): void {
    this.router.navigateByUrl('/unelte');
  }

  trackByTool(_: number, tool: ToolRecord): number {
    return tool.ToolId;
  }

  trackByEmployee(_: number, row: SsmEmployeeRow): number {
    return row.employee.UserId;
  }

  piecesOf(tool: ToolRecord): number {
    const pieces = Number(tool.Pieces);
    return Number.isFinite(pieces) && pieces > 0 ? pieces : 1;
  }

  locationOf(tool: ToolRecord): string {
    return String(tool.Location || tool.MainLocation || 'Fără locație');
  }

  employeeOf(tool: ToolRecord): string {
    return String(tool.AssignedUserName || tool.User || 'Nealocat');
  }

  statusLabel(tool: ToolRecord): string {
    if (tool.StatusLabel) return tool.StatusLabel;
    return ({ functionala: 'Funcțional', nefunctionala: 'Nefuncțional', in_lucru: 'În lucru' } as Record<string, string>)[String(tool.Status)] || 'Necunoscut';
  }

  private ssmCell(label: string, assigned: ToolRecord[], key: SsmEquipmentKey): SsmEquipmentCell {
    const tools = assigned.filter(tool => this.ssmEquipmentKey(tool) === key);
    return {
      label,
      tools,
      present: tools.length > 0,
      expired: tools.some(tool => this.isExpired(tool)),
    };
  }

  private ssmEquipmentKey(tool: ToolRecord): SsmEquipmentKey | null {
    const value = this.normalize(`${tool.ToolName} ${tool.Category || ''}`);
    if (value.includes('casca')) return 'helmet';
    if (value.includes('bocanc')) return 'boots';
    if (value.includes('vesta')) return 'vest';
    if (value.includes('manus')) return 'gloves';
    if (value.split(/\s+/).includes('ham') || value.includes('centura de siguranta')) return 'harness';
    return null;
  }

  private isActiveAssignmentFor(tool: ToolRecord, employee: EmployeeRecord): boolean {
    if (tool.IsReturned || tool.IsLost || tool.Status !== 'in_lucru') return false;
    if (Number(tool.AssignedUserId) === employee.UserId) return true;
    return this.normalize(tool.AssignedUserName || tool.User) === this.normalize(employee.UserName);
  }

  private isExpired(tool: ToolRecord): boolean {
    if (this.normalize(tool.SourceStatus).includes('expirat')) return true;
    if (!tool.ExpiryDate) return false;
    const expiry = new Date(`${tool.ExpiryDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return !Number.isNaN(expiry.getTime()) && expiry.getTime() < today.getTime();
  }

  private isAssigned(tool: ToolRecord): boolean {
    return Boolean(tool.AssignedUserName || tool.User) || tool.Status === 'in_lucru';
  }

  private unique(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ro'));
  }

  private normalize(value: unknown): string {
    return String(value || '').toLocaleLowerCase('ro').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private resetFilters(): void {
    this.searchTerm = '';
    this.categoryFilter = 'ALL';
    this.statusFilter = 'ALL';
    this.locationFilter = 'ALL';
    this.ssmStatusFilter = 'ALL';
    this.page = 1;
  }

  private ensureValidPage(): void {
    if (this.page > this.totalPages) this.page = this.totalPages;
  }
}
