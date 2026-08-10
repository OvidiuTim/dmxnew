import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { EmployeeTeam, TeamApiService, TeamEmployee, TeamRequest } from './team-api.service';

type TeamMode = 'permanent' | 'today' | 'available';

@Component({
  selector: 'app-teams-workspace',
  templateUrl: './teams-workspace.component.html',
  styleUrls: ['./teams-workspace.component.css'],
})
export class TeamsWorkspaceComponent implements OnInit, OnDestroy {
  mode: TeamMode = 'permanent';
  loading = false;
  saving = false;
  error = '';
  notice = '';
  searchTerm = '';
  memberSearch = '';
  teamStatus = 'all';
  availabilityFilter = 'all';
  selectedDate = this.todayISO();

  teams: EmployeeTeam[] = [];
  employees: TeamEmployee[] = [];
  requests: TeamRequest[] = [];
  dailyTeams: any[] = [];
  dailyAvailable: TeamEmployee[] = [];
  availableEmployees: TeamEmployee[] = [];
  manageableTeams: EmployeeTeam[] = [];
  canManageAll = false;

  teamDialogOpen = false;
  requestDialogOpen = false;
  teamForm: any = this.emptyTeamForm();
  requestForm: any = this.emptyRequestForm();
  assignmentTeam: Record<number, number | null> = {};
  private routeSubscription?: Subscription;

  constructor(private route: ActivatedRoute, private api: TeamApiService) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.data.subscribe(data => {
      this.mode = (data['teamMode'] || 'permanent') as TeamMode;
      this.searchTerm = '';
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  get title(): string {
    return this.mode === 'today' ? 'Echipele de azi' : this.mode === 'available' ? 'Personal disponibil' : 'Echipe permanente';
  }

  get subtitle(): string {
    if (this.mode === 'today') return 'Situația echipelor, transferurilor și absențelor pentru data selectată.';
    if (this.mode === 'available') return 'Angajați fără echipă sau disponibili pentru repartizare temporară.';
    return 'Configurează echipele, șefii și apartenența permanentă a muncitorilor.';
  }

  get filteredTeams(): EmployeeTeam[] {
    const search = this.normalize(this.searchTerm);
    return this.teams.filter(team => {
      const statusMatches = this.teamStatus === 'all' || (this.teamStatus === 'active' ? team.active : !team.active);
      return statusMatches && (!search || this.normalize(`${team.name} ${team.leader.name} ${team.members.map(item => item.name).join(' ')}`).includes(search));
    });
  }

  get filteredAvailable(): TeamEmployee[] {
    const search = this.normalize(this.searchTerm);
    return this.availableEmployees.filter(item => {
      const filterMatches = this.availabilityFilter === 'all'
        || (this.availabilityFilter === 'unassigned' && !item.team)
        || (this.availabilityFilter === 'requestable' && item.can_request)
        || (this.availabilityFilter === 'present' && item.presence === 'present')
        || (this.availabilityFilter === 'leave' && !!item.leave);
      return filterMatches && (!search || this.normalize(`${item.name} ${item.trade} ${item.team?.name || ''} ${item.worksite || ''}`).includes(search));
    });
  }

  get filteredDailyTeams(): any[] {
    const search = this.normalize(this.searchTerm);
    return this.dailyTeams.filter(team => !search || this.normalize(`${team.name} ${team.leader?.name || ''}`).includes(search));
  }

  get filteredRequests(): TeamRequest[] {
    const search = this.normalize(this.searchTerm);
    return this.requests.filter(item => !search || this.normalize(`${item.employee.name} ${item.source_team.name} ${item.requester_team.name} ${item.status_label}`).includes(search));
  }

  get activeTeams(): EmployeeTeam[] {
    return this.teams.filter(team => team.active);
  }

  get unassignedCount(): number {
    return this.employees.filter(employee => employee.active && !employee.team).length;
  }

  get requesterTeams(): EmployeeTeam[] {
    return this.activeTeams.filter(team => this.canManageAll || team.can_edit);
  }

  get requestableEmployees(): TeamEmployee[] {
    const leaders = new Set(this.activeTeams.map(team => team.leader.id));
    return this.employees.filter(item => item.active && item.team && item.can_request !== false && !leaders.has(item.id) && item.team.id !== Number(this.requestForm.requester_team_id));
  }

  get selectableLeaders(): TeamEmployee[] {
    return this.employees.filter(item => item.active && (!item.team || item.team.id === this.teamForm.id || item.id === this.teamForm.leader_id));
  }

  get selectableMembers(): TeamEmployee[] {
    const search = this.normalize(this.memberSearch);
    return this.employees.filter(item => {
      const available = item.active && (!item.team || item.team.id === this.teamForm.id || item.id === this.teamForm.leader_id);
      return available && (!search || this.normalize(`${item.name} ${item.trade} ${item.company}`).includes(search));
    });
  }

  load(): void {
    this.loading = true;
    this.error = '';
    if (this.mode === 'today') {
      this.api.getToday(this.selectedDate).subscribe({
        next: response => {
          this.dailyTeams = response.teams || [];
          this.dailyAvailable = response.available || [];
          this.loading = false;
        },
        error: error => this.handleError(error),
      });
      return;
    }
    if (this.mode === 'available') {
      this.api.getAvailable(this.selectedDate).subscribe({
        next: response => {
          this.availableEmployees = response.employees || [];
          this.manageableTeams = response.manageable_teams || [];
          this.loading = false;
        },
        error: error => this.handleError(error),
      });
      return;
    }
    forkJoin({ teams: this.api.getTeams(), requests: this.api.getRequests() }).subscribe({
      next: ({ teams, requests }) => {
        this.teams = teams.teams || [];
        this.employees = teams.employees || [];
        this.canManageAll = !!teams.permissions?.can_manage_all;
        this.requests = requests.requests || [];
        this.loading = false;
      },
      error: error => this.handleError(error),
    });
  }

  onDateChange(): void {
    this.load();
  }

  openCreateTeam(): void {
    this.teamForm = this.emptyTeamForm();
    this.memberSearch = '';
    this.teamDialogOpen = true;
  }

  openEditTeam(team: EmployeeTeam): void {
    this.teamForm = {
      id: team.id,
      name: team.name,
      leader_id: team.leader.id,
      default_worksite: team.default_worksite,
      active: team.active,
      member_ids: [...team.member_ids],
      can_manage_settings: team.can_manage_settings,
    };
    this.memberSearch = '';
    this.teamDialogOpen = true;
  }

  closeTeamDialog(): void {
    if (!this.saving) this.teamDialogOpen = false;
  }

  toggleMember(employeeId: number, checked: boolean): void {
    const selected = new Set<number>(this.teamForm.member_ids || []);
    checked ? selected.add(employeeId) : selected.delete(employeeId);
    this.teamForm.member_ids = [...selected];
  }

  isMemberSelected(employeeId: number): boolean {
    return (this.teamForm.member_ids || []).includes(employeeId);
  }

  saveTeam(): void {
    this.saving = true;
    this.error = '';
    const payload = {
      name: this.teamForm.name,
      leader_id: Number(this.teamForm.leader_id),
      default_worksite: this.teamForm.default_worksite || '',
      active: !!this.teamForm.active,
      member_ids: (this.teamForm.member_ids || []).map(Number),
    };
    const operation = this.teamForm.id ? this.api.updateTeam(this.teamForm.id, payload) : this.api.createTeam(payload);
    operation.subscribe({
      next: () => {
        this.saving = false;
        this.teamDialogOpen = false;
        this.notice = this.teamForm.id ? 'Echipa a fost actualizată.' : 'Echipa a fost creată.';
        this.load();
      },
      error: error => {
        this.saving = false;
        this.error = this.errorMessage(error);
      },
    });
  }

  removeMember(team: EmployeeTeam, employee: TeamEmployee): void {
    if (!confirm(`Elimini ${employee.name} din ${team.name}?`)) return;
    this.api.updateMember(team.id, employee.id, 'remove').subscribe({
      next: () => { this.notice = 'Membrul a fost eliminat.'; this.load(); },
      error: error => this.handleError(error),
    });
  }

  addPermanent(employee: TeamEmployee): void {
    const teamId = Number(this.assignmentTeam[employee.id]);
    if (!teamId) return;
    this.api.updateMember(teamId, employee.id, 'add').subscribe({
      next: () => { this.notice = `${employee.name} a fost adăugat în echipă.`; this.load(); },
      error: error => this.handleError(error),
    });
  }

  openRequest(employee?: TeamEmployee): void {
    if (!this.teams.length) {
      forkJoin({ teams: this.api.getTeams(), requests: this.api.getRequests() }).subscribe({
        next: ({ teams, requests }) => {
          this.teams = teams.teams || [];
          this.employees = teams.employees || [];
          this.canManageAll = !!teams.permissions?.can_manage_all;
          this.requests = requests.requests || [];
          this.setRequestForm(employee);
        },
        error: error => this.handleError(error),
      });
      return;
    }
    this.setRequestForm(employee);
  }

  private setRequestForm(employee?: TeamEmployee): void {
    const requester = this.requesterTeams.find(team => !employee?.team || team.id !== employee.team.id);
    this.requestForm = {
      ...this.emptyRequestForm(),
      requester_team_id: requester?.id || null,
      employee_id: employee?.id || null,
    };
    this.requestDialogOpen = true;
  }

  closeRequestDialog(): void {
    if (!this.saving) this.requestDialogOpen = false;
  }

  saveRequest(): void {
    this.saving = true;
    this.api.createRequest({
      requester_team_id: Number(this.requestForm.requester_team_id),
      employee_id: Number(this.requestForm.employee_id),
      start_date: this.requestForm.start_date,
      end_date: this.requestForm.end_date,
      reason: this.requestForm.reason || '',
    }).subscribe({
      next: () => {
        this.saving = false;
        this.requestDialogOpen = false;
        this.notice = 'Solicitarea a fost trimisă.';
        this.load();
      },
      error: error => {
        this.saving = false;
        this.error = this.errorMessage(error);
      },
    });
  }

  requestAction(item: TeamRequest, action: 'approve' | 'reject' | 'cancel'): void {
    this.api.actOnRequest(item.id, action).subscribe({
      next: () => {
        this.notice = action === 'approve' ? 'Solicitarea a fost aprobată.' : action === 'reject' ? 'Solicitarea a fost respinsă.' : 'Solicitarea a fost anulată.';
        this.load();
      },
      error: error => this.handleError(error),
    });
  }

  categoryLabel(category: string): string {
    return ({ leader: 'Șef de echipă', permanent: 'Permanent', received: 'Primit temporar', sent: 'Trimis temporar', available: 'Disponibil' } as any)[category] || category;
  }

  statusLabel(item: TeamEmployee): string {
    if (item.leave) return item.leave.label;
    if (item.temporary_team) return `Alocat temporar · ${item.temporary_team.name}`;
    if (item.presence === 'present') return 'Prezent';
    return 'Fără pontaj';
  }

  trackById = (_: number, item: any) => item.id;

  private emptyTeamForm(): any {
    return { id: null, name: '', leader_id: null, default_worksite: '', active: true, member_ids: [], can_manage_settings: true };
  }

  private emptyRequestForm(): any {
    return { requester_team_id: null, employee_id: null, start_date: this.todayISO(), end_date: this.todayISO(), reason: '' };
  }

  private todayISO(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private normalize(value: string): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private handleError(error: any): void {
    this.error = this.errorMessage(error);
    this.loading = false;
  }

  private errorMessage(error: any): string {
    const payload = error?.error;
    const detail = payload?.details ? this.flattenErrors(payload.details) : '';
    return detail || payload?.error || 'Operațiunea nu a putut fi finalizată.';
  }

  private flattenErrors(value: any): string {
    if (Array.isArray(value)) return value.map(item => this.flattenErrors(item)).filter(Boolean).join(' ');
    if (value && typeof value === 'object') return Object.values(value).map(item => this.flattenErrors(item)).filter(Boolean).join(' ');
    return String(value || '');
  }
}
