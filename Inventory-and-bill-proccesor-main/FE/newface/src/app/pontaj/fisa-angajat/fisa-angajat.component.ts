import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SharedService } from '../../shared.service';

type SheetTab = 'general' | 'site' | 'ssm';

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
  employee: EmployeeProfile | null = null;
  siteTools: EmployeeTool[] = [];
  ssmTools: EmployeeTool[] = [];

  activeTab: SheetTab = 'general';
  dropdownOpen = false;
  openToolMenuId: number | null = null;

  loading = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: SharedService,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    const parsedId = Number(rawId);

    if (!rawId || !Number.isFinite(parsedId)) {
      this.error = 'Lipseste angajatul pentru fisa.';
      return;
    }

    this.userId = parsedId;
    this.loadEmployeeSheet(parsedId);
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
    }).subscribe({
      next: ({ employee, siteTools, ssmTools }) => {
        this.employee = employee ?? null;
        this.siteTools = (siteTools ?? []) as EmployeeTool[];
        this.ssmTools = (ssmTools ?? []) as EmployeeTool[];
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
      in_lucru: 'In lucru',
      magazie: 'In magazie',
      stricata: 'Stricata',
    };
    return labels[normalized] ?? 'In lucru';
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

  piecesCount(tool: Pick<EmployeeTool, 'Pieces'> | null | undefined): number {
    if (tool?.Pieces === null || tool?.Pieces === undefined) {
      return 1;
    }
    const pieces = Number(tool.Pieces);
    return Number.isFinite(pieces) ? Math.max(0, Math.floor(pieces)) : 1;
  }

  private normalizeStatus(status: string | null | undefined): string {
    const normalized = String(status ?? '').trim().toLowerCase().replace(/\s+/g, '_');
    if (normalized === 'magazie' || normalized === 'stricata' || normalized === 'in_lucru') {
      return normalized;
    }
    return 'in_lucru';
  }
}
