import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { EmployeeTeam, LeaveNotification, TeamApiService, TeamEmployee, TeamRequest } from './team-api.service';

type TeamMode = 'permanent' | 'mine' | 'today' | 'available' | 'notifications';

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
  leaderSearch = '';
  teamStatus = 'all';
  availabilityFilter = 'all';
  personnelTab: 'unassigned' | 'assigned' = 'unassigned';
  leaderSearchFocused = false;
  selectedDate = this.todayISO();

  teams: EmployeeTeam[] = [];
  employees: TeamEmployee[] = [];
  requests: TeamRequest[] = [];
  leaveNotifications: LeaveNotification[] = [];
  dailyTeams: any[] = [];
  dailyAvailable: TeamEmployee[] = [];
  availableEmployees: TeamEmployee[] = [];
  manageableTeams: EmployeeTeam[] = [];
  canManageAll = false;
  leaderTeamIds: number[] = [];

  teamDialogOpen = false;
  requestDialogOpen = false;
  memberRequestsDialogOpen = false;
  memberActionsOpenFor: number | null = null;
  teamForm: any = this.emptyTeamForm();
  requestForm: any = this.emptyRequestForm();
  memberRequestEmployee: TeamEmployee | null = null;
  memberRequestDetails: TeamRequest[] = [];
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
    if (this.mode === 'mine') return 'Echipa mea';
    if (this.mode === 'notifications') return 'Notificări';
    return this.mode === 'today' ? 'Echipele de azi' : this.mode === 'available' ? 'Personal' : 'Echipe permanente';
  }

  get subtitle(): string {
    if (this.mode === 'today') return 'Situația echipelor, transferurilor și absențelor pentru data selectată.';
    if (this.mode === 'available') return 'Gestionează separat angajații atribuiți și neatribuiți.';
    if (this.mode === 'notifications') return 'Cererile de personal și de concediu care necesită atenția ta.';
    if (this.mode === 'mine') return 'Vezi și actualizează membrii echipei pe care o conduci.';
    return 'Configurează echipele, șefii și apartenența permanentă a muncitorilor.';
  }

  get filteredTeams(): EmployeeTeam[] {
    const search = this.normalize(this.searchTerm);
    return this.teams.filter(team => {
      const ownershipMatches = this.mode !== 'mine' || this.leaderTeamIds.includes(team.id);
      const statusMatches = this.teamStatus === 'all' || (this.teamStatus === 'active' ? team.active : !team.active);
      return ownershipMatches && statusMatches && (!search || this.normalize(`${team.name} ${team.leader.name} ${team.members.map(item => item.name).join(' ')}`).includes(search));
    });
  }

  get filteredAvailable(): TeamEmployee[] {
    const search = this.normalize(this.searchTerm);
    return this.availableEmployees.filter(item => {
      const tabMatches = this.personnelTab === 'unassigned' ? !item.team : !!item.team;
      const filterMatches = this.availabilityFilter === 'all'
        || (this.availabilityFilter === 'unassigned' && !item.team)
        || (this.availabilityFilter === 'requestable' && item.can_request)
        || (this.availabilityFilter === 'present' && item.presence === 'present')
        || (this.availabilityFilter === 'leave' && !!item.leave);
      return tabMatches && filterMatches && (!search || this.normalize(`${item.name} ${item.trade} ${item.team?.name || ''} ${item.worksite || ''}`).includes(search));
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

  get filteredLeaveNotifications(): LeaveNotification[] {
    const search = this.normalize(this.searchTerm);
    return this.leaveNotifications.filter(item => !search || this.normalize(
      `${item.employee.name} ${item.employee.trade} ${item.team?.name || ''} ${item.leave_type_label} ${item.status_label}`
    ).includes(search));
  }

  get notificationCount(): number {
    return this.filteredRequests.length + this.filteredLeaveNotifications.length;
  }

  get pendingRequestCount(): number {
    return this.requests.filter(item => item.status === 'pending').length
      + this.leaveNotifications.filter(item => item.status === 'pending').length;
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

  get selectedRequestedEmployee(): TeamEmployee | undefined {
    return this.employees.find(item => item.id === Number(this.requestForm.employee_id));
  }

  get selectableLeaders(): TeamEmployee[] {
    const search = this.normalize(this.leaderSearch);
    return this.employees.filter(item => {
      const available = item.active && (!item.team || item.team.id === this.teamForm.id || item.id === this.teamForm.leader_id);
      return available && (!search || this.normalize(item.name).includes(search));
    });
  }

  get leaderResults(): TeamEmployee[] {
    if (!this.leaderSearch.trim()) return [];
    return this.selectableLeaders.slice(0, 8);
  }

  get selectedLeader(): TeamEmployee | undefined {
    return this.employees.find(item => item.id === Number(this.teamForm.leader_id));
  }

  get selectableMembers(): TeamEmployee[] {
    const search = this.normalize(this.memberSearch);
    const currentTeamId = Number(this.teamForm.id);
    return this.employees
      .filter(item => {
        const available = item.active && (!item.team || item.team.id === this.teamForm.id || item.id === this.teamForm.leader_id);
        return available && (!search || this.normalize(`${item.name} ${item.trade} ${item.company}`).includes(search));
      })
      .sort((first, second) => {
        const firstInCurrentTeam = currentTeamId > 0 && first.team?.id === currentTeamId;
        const secondInCurrentTeam = currentTeamId > 0 && second.team?.id === currentTeamId;
        if (firstInCurrentTeam !== secondInCurrentTeam) return firstInCurrentTeam ? -1 : 1;
        return first.name.localeCompare(second.name, 'ro');
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
    if (this.mode === 'notifications') {
      this.api.getNotifications().subscribe({
        next: response => {
          this.requests = response.requests || [];
          this.leaveNotifications = response.leave_requests || [];
          this.loading = false;
          window.dispatchEvent(new CustomEvent('team-notifications-changed'));
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
        this.leaderTeamIds = teams.permissions?.leader_team_ids || [];
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
    this.leaderSearch = '';
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
      leader_email: team.leader.email || '',
      can_manage_settings: team.can_manage_settings,
      can_edit: team.can_edit,
    };
    this.memberSearch = '';
    this.leaderSearch = team.leader.name;
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

  selectLeader(employee: TeamEmployee): void {
    this.teamForm.leader_id = employee.id;
    this.teamForm.leader_email = employee.email || '';
    this.leaderSearch = employee.name;
    this.leaderSearchFocused = false;
  }

  onLeaderSearchInput(): void {
    if (this.selectedLeader && this.normalize(this.leaderSearch) !== this.normalize(this.selectedLeader.name)) {
      this.teamForm.leader_id = null;
      this.teamForm.leader_email = '';
    }
  }

  saveTeam(): void {
    this.saving = true;
    this.error = '';
    const payload = {
      name: this.teamForm.name,
      leader_id: Number(this.teamForm.leader_id),
      leader_email: (this.teamForm.leader_email || '').trim(),
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
    this.memberActionsOpenFor = null;
    if (!confirm(`Elimini ${employee.name} din ${team.name}?`)) return;
    this.api.updateMember(team.id, employee.id, 'remove').subscribe({
      next: () => { this.notice = 'Membrul a fost eliminat.'; this.load(); },
      error: error => this.handleError(error),
    });
  }

  takeInMyTeam(employee: TeamEmployee): void {
    const teamId = Number(employee.target_team_id);
    if (!teamId) return;
    this.api.updateMember(teamId, employee.id, 'add').subscribe({
      next: () => { this.notice = `${employee.name} a fost adăugat în echipă.`; this.load(); },
      error: error => this.handleError(error),
    });
  }

  openRequest(employee?: TeamEmployee, requestType: 'temporary' | 'permanent' = 'temporary'): void {
    if (!this.teams.length) {
      forkJoin({ teams: this.api.getTeams(), requests: this.api.getRequests() }).subscribe({
        next: ({ teams, requests }) => {
          this.teams = teams.teams || [];
          this.employees = teams.employees || [];
          this.canManageAll = !!teams.permissions?.can_manage_all;
          this.requests = requests.requests || [];
          this.setRequestForm(employee, requestType);
        },
        error: error => this.handleError(error),
      });
      return;
    }
    this.setRequestForm(employee, requestType);
  }

  private setRequestForm(employee?: TeamEmployee, requestType: 'temporary' | 'permanent' = 'temporary'): void {
    const requester = this.requesterTeams.find(team => !employee?.team || team.id !== employee.team.id);
    this.requestForm = {
      ...this.emptyRequestForm(),
      requester_team_id: requester?.id || null,
      employee_id: employee?.id || null,
      request_type: requestType,
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
      request_type: this.requestForm.request_type,
    }).subscribe({
      next: response => {
        this.saving = false;
        this.requestDialogOpen = false;
        this.notice = response?.email_sent
          ? 'Solicitarea a fost trimisă și pe email șefului echipei.'
          : 'Solicitarea a fost trimisă. Emailul nu a fost expediat deoarece șeful nu are email configurat sau serviciul de email nu este disponibil.';
        this.load();
        window.dispatchEvent(new CustomEvent('team-notifications-changed'));
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
        window.dispatchEvent(new CustomEvent('team-notifications-changed'));
      },
      error: error => this.handleError(error),
    });
  }

  openMemberRequests(employee: TeamEmployee): void {
    if (!employee.active_requests?.length) return;
    this.memberRequestEmployee = employee;
    this.memberRequestDetails = employee.active_requests;
    this.memberRequestsDialogOpen = true;
  }

  toggleMemberActions(employeeId: number): void {
    this.memberActionsOpenFor = this.memberActionsOpenFor === employeeId ? null : employeeId;
  }

  closeMemberRequestsDialog(): void {
    this.memberRequestsDialogOpen = false;
    this.memberRequestEmployee = null;
    this.memberRequestDetails = [];
  }

  categoryLabel(category: string): string {
    return ({ leader: 'Șef de echipă', permanent: 'Permanent', received: 'Împrumutat de la altă echipă', sent: 'Împrumutat altei echipe', available: 'Disponibil' } as any)[category] || category;
  }

  statusLabel(item: TeamEmployee): string {
    if (item.leave) return item.leave.label;
    if (item.temporary_team) return `Alocat temporar · ${item.temporary_team.name}`;
    if (item.presence === 'present') return 'Prezent';
    return 'Fără pontaj';
  }

  trackById = (_: number, item: any) => item.id;

  private emptyTeamForm(): any {
    return { id: null, name: '', leader_id: null, leader_email: '', default_worksite: '', active: true, member_ids: [], can_manage_settings: true };
  }

  private emptyRequestForm(): any {
    return { requester_team_id: null, employee_id: null, request_type: 'temporary', start_date: this.todayISO(), end_date: this.todayISO(), reason: '' };
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
