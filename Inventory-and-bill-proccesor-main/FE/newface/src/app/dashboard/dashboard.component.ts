import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { SharedService } from '../shared.service';
import { AuthService } from '../auth/auth.service';

type RawHistory = {
  direction?: 'OUT' | 'IN' | string;
  quantity?: number;
  timestamp?: string;
  DateOfGiving?: string;
  User?: string;
  Tool?: string;
  ToolSerie?: string;
  GiveRecive?: string;
  user?: { UserId: number; UserName: string; UserSerie: string };
  tool?: { ToolId: number; ToolName: string; ToolSerie: string };
};

type ViewHistory = {
  displayUser: string;
  displayTool: string;
  displayAction: 'a preluat' | 'a predat';
  isOut: boolean;
  quantity: number;
  timestamp: Date;
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  histToolList: ViewHistory[] = [];
  attendanceRows: any[] = [];
  totalEmployees = 0;
  presentNow = 0;
  clockedToday = 0;
  finishedToday = 0;
  totalWorkedSeconds = 0;
  worksitesCount = 0;
  totalDayCost = 0;
  worksiteCosts: Array<{ worksite: string; total_cost: number; total_hms: string }> = [];
  loadingAttendance = true;
  loadingHistory = true;
  loadingReports = true;
  attendanceError: string | null = null;
  historyError: string | null = null;
  reportsError: string | null = null;

  constructor(private service: SharedService, private auth: AuthService) {}

  ngOnInit(): void { this.refreshAll(); }

  refreshAll(): void {
    this.loadAttendance();
    this.loadReports();
    this.refreshHisList();
  }

  private loadAttendance(): void {
    this.loadingAttendance = true;
    this.attendanceError = null;
    forkJoin({ day: this.service.getAttendanceDay(this.todayISO), users: this.service.getUsrList() }).subscribe({
      next: ({ day, users }) => {
        this.attendanceRows = day?.rows ?? [];
        const eligibleUsers = (users ?? []).filter((user: any) =>
          (user.person_type || 'employee') === 'employee'
          && (user.employment_status || 'active') !== 'dismissed'
          && user.active !== false
          && user.attendance_exempt !== true
        );
        this.totalEmployees = eligibleUsers.length;
        this.presentNow = this.attendanceRows.filter(row => row.status === 'IN').length;
        this.clockedToday = this.attendanceRows.filter(row => row.status === 'IN' || row.status === 'OUT').length;
        this.finishedToday = this.attendanceRows.filter(row => row.status === 'OUT').length;
        this.totalWorkedSeconds = this.attendanceRows.reduce((sum, row) => sum + this.secondsFromRow(row), 0);
        this.loadingAttendance = false;
      },
      error: () => {
        this.loadingAttendance = false;
        this.attendanceError = 'Datele de prezență nu au putut fi încărcate.';
      }
    });
  }

  private loadReports(): void {
    this.loadingReports = true;
    this.reportsError = null;
    forkJoin({
      worksites: this.service.getAttendanceWorksiteReport(this.monthStartISO, this.todayISO),
      dayCost: this.service.getAttendanceDayCostReport(this.todayISO)
    }).subscribe({
      next: ({ worksites, dayCost }) => {
        this.worksitesCount = Number(worksites?.summary?.worksites_count ?? worksites?.rows?.length ?? 0);
        this.totalDayCost = Number(dayCost?.summary?.total_cost ?? 0);
        this.worksiteCosts = (dayCost?.worksites ?? []).map((item: any) => ({
          worksite: item.worksite || 'Fără șantier asignat',
          total_cost: Number(item.total_cost ?? 0),
          total_hms: item.total_hms || '00:00:00',
        }));
        this.loadingReports = false;
      },
      error: () => {
        this.loadingReports = false;
        this.reportsError = 'Rezumatul financiar și cel pe șantiere nu sunt disponibile momentan.';
      }
    });
  }

  refreshHisList(): void {
    this.loadingHistory = true;
    this.historyError = null;
    this.service.getHisList().subscribe({
      next: (data: RawHistory[]) => {
        this.histToolList = (data ?? [])
          .map(item => this.normalizeHistory(item))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        this.loadingHistory = false;
      },
      error: () => {
        this.loadingHistory = false;
        this.historyError = 'Activitatea recentă din magazie nu a putut fi încărcată.';
      }
    });
  }

  get recentHistory(): ViewHistory[] { return this.histToolList.slice(0, 6); }
  get isGeneralPasswordSession(): boolean { return this.auth.currentSession()?.auth_type === 'legacy'; }
  get leaveToday(): number { return this.attendanceRows.filter(row => row.status === 'LEAVE').length; }
  get absentToday(): number { return Math.max(0, this.totalEmployees - this.clockedToday - this.leaveToday); }
  get presencePercent(): number { return this.totalEmployees ? Math.round((this.clockedToday / this.totalEmployees) * 100) : 0; }
  get totalWorkedLabel(): string {
    const hours = Math.floor(this.totalWorkedSeconds / 3600);
    const minutes = Math.floor((this.totalWorkedSeconds % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  get averageWorkedLabel(): string {
    if (!this.clockedToday) return '0h 00m';
    const seconds = Math.round(this.totalWorkedSeconds / this.clockedToday);
    return `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`;
  }
  get todayLabel(): string {
    return new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  private get todayISO(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private get monthStartISO(): string { return `${this.todayISO.slice(0, 8)}01`; }

  private secondsFromRow(row: any): number {
    if (Number.isFinite(Number(row?.total_seconds))) return Number(row.total_seconds);
    const parts = String(row?.total_hms || '0:0:0').split(':').map(Number);
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }

  private normalizeHistory(item: RawHistory): ViewHistory {
    const direction = this.resolveDirection(item);
    const isOut = direction === 'OUT';
    const rawTimestamp = item.timestamp || item.DateOfGiving;
    const parsed = rawTimestamp ? new Date(rawTimestamp) : new Date();
    return {
      displayUser: item.user?.UserName || item.User || 'Utilizator necunoscut',
      displayTool: item.tool?.ToolName || item.Tool || item.ToolSerie || 'Unealtă necunoscută',
      displayAction: isOut ? 'a preluat' : 'a predat',
      isOut,
      quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1,
      timestamp: Number.isNaN(parsed.getTime()) ? new Date() : parsed,
    };
  }

  private resolveDirection(item: RawHistory): 'OUT' | 'IN' {
    const direction = String(item.direction || '').toUpperCase();
    if (direction.startsWith('IN')) return 'IN';
    if (direction.startsWith('OUT')) return 'OUT';
    const legacy = String(item.GiveRecive || '').toLowerCase();
    return legacy.includes('adus') || legacy.includes('predat') || legacy.includes('intrare') ? 'IN' : 'OUT';
  }
}
