import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
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
  User?: string | null;
  Pieces?: number | null;
  IsSSM: boolean;
  Status?: string | null;
  StatusLabel?: string | null;
  RequiresVerification?: boolean;
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
  loading = true;
  error = '';
  searchTerm = '';
  categoryFilter = 'ALL';
  statusFilter = 'ALL';
  locationFilter = 'ALL';
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
    this.service.getTolList({ is_ssm: this.isSsm }).subscribe({
      next: data => {
        this.tools = Array.isArray(data) ? data as ToolRecord[] : [];
        this.loading = false;
        this.ensureValidPage();
      },
      error: () => {
        this.tools = [];
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
    return this.tools.filter(tool => !this.isAssigned(tool) && tool.Status === 'magazie').reduce((total, tool) => total + this.piecesOf(tool), 0);
  }

  get verificationCount(): number {
    return this.tools.filter(tool => Boolean(tool.RequiresVerification)).length;
  }

  get filteredTools(): ToolRecord[] {
    const query = this.normalize(this.searchTerm);
    return this.tools.filter(tool => {
      const searchable = [
        tool.ToolName, tool.ToolSerie, tool.DisplaySerie, tool.Category, tool.Brand,
        tool.Model, tool.SerialNumber, this.locationOf(tool), this.employeeOf(tool)
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
    return Math.max(1, Math.ceil(this.filteredTools.length / this.pageSize));
  }

  get firstVisible(): number {
    return this.filteredTools.length ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get lastVisible(): number {
    return Math.min(this.page * this.pageSize, this.filteredTools.length);
  }

  filtersChanged(): void {
    this.page = 1;
  }

  clearFilters(): void {
    this.resetFilters();
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
    return ({ magazie: 'În magazie', in_lucru: 'În lucru', stricata: 'Defect' } as Record<string, string>)[String(tool.Status)] || 'Necunoscut';
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
    this.page = 1;
  }

  private ensureValidPage(): void {
    if (this.page > this.totalPages) this.page = this.totalPages;
  }
}
