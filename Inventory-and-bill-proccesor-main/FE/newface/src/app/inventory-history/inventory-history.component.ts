import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { SharedService } from '../shared.service';

type HistoryRecord = {
  HistoryId: number;
  timestamp?: string | null;
  direction?: 'OUT' | 'IN' | 'ADJ' | string;
  quantity?: number | null;
  note?: string | null;
  user_fk?: number | null;
  tool_fk?: number | null;
  issued_by?: number | null;
  user?: { UserId: number; UserName: string; UserSerie?: string; person_type?: 'employee' | 'collaborator'; person_type_label?: string } | null;
  tool?: { ToolId: number; ToolName: string; ToolSerie?: string | null } | null;
  User?: string | null;
  Tool?: string | null;
  ToolSerie?: string | null;
  DateOfGiving?: string | null;
};

type ToolMeta = { ToolId: number; ToolName: string; ToolSerie?: string | null; IsSSM?: boolean; Category?: string | null };
type UserMeta = { UserId: number; UserName: string; person_type?: 'employee' | 'collaborator'; person_type_label?: string };

@Component({
  selector: 'app-inventory-history',
  templateUrl: './inventory-history.component.html',
  styleUrls: ['./inventory-history.component.css']
})
export class InventoryHistoryComponent implements OnInit {
  histories: HistoryRecord[] = [];
  tools = new Map<number, ToolMeta>();
  users = new Map<number, UserMeta>();
  loading = true;
  error = '';
  searchTerm = '';
  typeFilter = 'ALL';
  directionFilter = 'ALL';
  periodFilter = 'ALL';
  page = 1;
  readonly pageSize = 12;
  selected: HistoryRecord | null = null;

  constructor(private readonly service: SharedService) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      histories: this.service.getHisList(),
      tools: this.service.getTolList(),
      users: this.service.getUsrList()
    }).pipe(
      switchMap(result => {
        const listedIds = new Set((result.tools || []).map((tool: ToolMeta) => Number(tool.ToolId)));
        const missingIds = [...new Set((result.histories || [])
          .map((item: HistoryRecord) => Number(item.tool?.ToolId || item.tool_fk))
          .filter((id: number) => id > 0 && !listedIds.has(id))
        )];
        if (!missingIds.length) return of(result);
        return forkJoin(missingIds.map(id => this.service.getTool(id).pipe(catchError(() => of(null))))).pipe(
          map(extraTools => ({ ...result, tools: [...(result.tools || []), ...extraTools.filter(Boolean)] }))
        );
      })
    ).subscribe({
      next: result => {
        this.histories = Array.isArray(result.histories) ? result.histories : [];
        this.tools = new Map((result.tools || []).map((tool: ToolMeta) => [Number(tool.ToolId), tool]));
        this.users = new Map((result.users || []).map((user: UserMeta) => [Number(user.UserId), user]));
        this.loading = false;
        this.page = 1;
      },
      error: () => {
        this.histories = [];
        this.loading = false;
        this.error = 'Nu am putut încărca istoricul și datele de inventar asociate. Încearcă din nou.';
      }
    });
  }

  get outCount(): number { return this.histories.filter(item => item.direction === 'OUT').length; }
  get inCount(): number { return this.histories.filter(item => item.direction === 'IN').length; }
  get adjustmentCount(): number { return this.histories.filter(item => item.direction === 'ADJ').length; }
  get ssmCount(): number { return this.histories.filter(item => this.isSsm(item)).length; }

  get filteredHistories(): HistoryRecord[] {
    const query = this.normalize(this.searchTerm);
    const cutoff = this.periodCutoff();
    return this.histories.filter(item => {
      const tool = this.toolMeta(item);
      const text = [this.toolName(item), this.toolSerie(item), item.user?.UserName, item.User, this.operatorName(item), item.note, tool?.Category]
        .map(value => this.normalize(value)).join(' ');
      const timestamp = this.dateOf(item);
      return (!query || text.includes(query))
        && (this.typeFilter === 'ALL' || (this.typeFilter === 'SSM') === this.isSsm(item))
        && (this.directionFilter === 'ALL' || item.direction === this.directionFilter)
        && (!cutoff || (timestamp && timestamp >= cutoff));
    });
  }

  get pagedHistories(): HistoryRecord[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredHistories.slice(start, start + this.pageSize);
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.filteredHistories.length / this.pageSize)); }
  get firstVisible(): number { return this.filteredHistories.length ? (this.page - 1) * this.pageSize + 1 : 0; }
  get lastVisible(): number { return Math.min(this.page * this.pageSize, this.filteredHistories.length); }

  filtersChanged(): void { this.page = 1; this.selected = null; }
  changePage(next: number): void { this.page = Math.min(Math.max(next, 1), this.totalPages); this.selected = null; }
  select(item: HistoryRecord): void { this.selected = this.selected?.HistoryId === item.HistoryId ? null : item; }
  trackByHistory(_: number, item: HistoryRecord): number { return item.HistoryId; }

  toolName(item: HistoryRecord): string { return item.tool?.ToolName || item.Tool || 'Unealtă indisponibilă'; }
  toolSerie(item: HistoryRecord): string { return String(item.tool?.ToolSerie || item.ToolSerie || 'Fără serie'); }
  category(item: HistoryRecord): string { return this.toolMeta(item)?.Category || (this.isSsm(item) ? 'Echipament SSM' : 'Sculă'); }
  employeeName(item: HistoryRecord): string { return item.user?.UserName || item.User || 'Nespecificat'; }
  personTypeLabel(item: HistoryRecord): string {
    const user = item.user || this.users.get(Number(item.user_fk));
    if (!user) return 'Nespecificat';
    return user.person_type_label || (user.person_type === 'collaborator' ? 'Colaborator' : 'Angajat');
  }
  personDisplay(item: HistoryRecord): string { return `${this.employeeName(item)} (${this.personTypeLabel(item)})`; }
  operatorName(item: HistoryRecord): string { return this.users.get(Number(item.issued_by))?.UserName || 'Nespecificat'; }
  quantity(item: HistoryRecord): number { const value = Number(item.quantity); return Number.isFinite(value) && value > 0 ? value : 1; }
  directionLabel(item: HistoryRecord): string { return ({ OUT: 'Predare', IN: 'Returnare', ADJ: 'Ajustare' } as Record<string, string>)[String(item.direction)] || 'Operațiune'; }
  directionIcon(item: HistoryRecord): string { return item.direction === 'OUT' ? 'arrow-up' : item.direction === 'IN' ? 'arrow-down' : 'adjust'; }
  origin(item: HistoryRecord): string { return item.direction === 'IN' ? this.personDisplay(item) : item.direction === 'OUT' ? 'Magazie' : 'Inventar'; }
  destination(item: HistoryRecord): string { return item.direction === 'OUT' ? this.personDisplay(item) : item.direction === 'IN' ? 'Magazie' : 'Inventar'; }
  isSsm(item: HistoryRecord): boolean { return Boolean(this.toolMeta(item)?.IsSSM); }

  dateOf(item: HistoryRecord): Date | null {
    const raw = item.timestamp || item.DateOfGiving;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toolMeta(item: HistoryRecord): ToolMeta | undefined {
    return this.tools.get(Number(item.tool?.ToolId || item.tool_fk));
  }

  private periodCutoff(): Date | null {
    if (this.periodFilter === 'ALL') return null;
    const days = Number(this.periodFilter);
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - days);
    return date;
  }

  private normalize(value: unknown): string {
    return String(value || '').toLocaleLowerCase('ro').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}
