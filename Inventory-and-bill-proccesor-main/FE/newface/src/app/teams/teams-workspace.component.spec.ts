import { TeamsWorkspaceComponent } from './teams-workspace.component';
import { of } from 'rxjs';

describe('TeamsWorkspaceComponent', () => {
  function employee(id: number, name: string, trade: string) {
    return { id, name, trade, company: 'RNX', serie: String(id), active: true, team: null } as any;
  }

  it('afișează în modul Echipa mea numai echipa condusă de utilizator', () => {
    const component = new TeamsWorkspaceComponent({} as any, {} as any);
    component.mode = 'mine';
    component.leaderTeamIds = [2];
    component.teams = [
      { id: 1, name: 'Alfa', leader: employee(1, 'Lider A', 'Șef'), members: [], active: true } as any,
      { id: 2, name: 'Beta', leader: employee(2, 'Lider B', 'Șef'), members: [], active: true } as any,
    ];

    expect(component.filteredTeams.map(team => team.id)).toEqual([2]);
  });

  it('filtrează șefii de echipă numai după nume', () => {
    const component = new TeamsWorkspaceComponent({} as any, {} as any);
    component.employees = [employee(1, 'Ion Pop', 'Dulgher'), employee(2, 'Mihai Stan', 'Fierar')];
    component.leaderSearch = 'mihai';

    expect(component.selectableLeaders.map(item => item.name)).toEqual(['Mihai Stan']);
    component.leaderSearch = 'fierar';
    expect(component.selectableLeaders).toEqual([]);
  });

  it('permite selectarea aceleiași persoane ca șef și supervisor', () => {
    const component = new TeamsWorkspaceComponent({} as any, {} as any);
    const manager = employee(1, 'Ion Manager', 'Maistru');
    component.employees = [manager];

    component.selectLeader(manager);
    component.selectSupervisor(manager);

    expect(component.teamForm.leader_id).toBe(1);
    expect(component.teamForm.supervisor_id).toBe(1);
  });

  it('afișează întâi membrii echipei editate', () => {
    const component = new TeamsWorkspaceComponent({} as any, {} as any);
    const member = { ...employee(2, 'Zoe Membru', 'Fierar'), team: { id: 7, name: 'Echipa Verde' } };
    const available = employee(1, 'Ana Liberă', 'Dulgher');
    component.teamForm = { id: 7, leader_id: 2 } as any;
    component.employees = [available, member];

    expect(component.selectableMembers.map(item => item.id)).toEqual([2, 1]);
  });

  it('deschide detaliile solicitărilor active ale unui membru', () => {
    const component = new TeamsWorkspaceComponent({} as any, {} as any);
    const member = {
      ...employee(2, 'Muncitor A', 'Fierar'),
      active_requests: [{ id: 11, request_type: 'temporary' }],
    } as any;

    component.openMemberRequests(member);

    expect(component.memberRequestsDialogOpen).toBeTrue();
    expect(component.memberRequestEmployee).toBe(member);
    expect(component.memberRequestDetails).toEqual(member.active_requests);
  });

  it('deschide și închide meniul de acțiuni al unui membru', () => {
    const component = new TeamsWorkspaceComponent({} as any, {} as any);

    component.toggleMemberActions(7);
    expect(component.memberActionsOpenFor).toBe(7);

    component.toggleMemberActions(7);
    expect(component.memberActionsOpenFor).toBeNull();
  });

  it('șterge echipa după confirmare și reîncarcă lista', () => {
    const api = { deleteTeam: jasmine.createSpy().and.returnValue(of({ deleted: true })) } as any;
    const component = new TeamsWorkspaceComponent({} as any, api);
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(component, 'load');
    const team = { id: 7, name: 'Echipa Verde', can_delete: true } as any;

    component.deleteTeam(team);

    expect(api.deleteTeam).toHaveBeenCalledWith(7);
    expect(component.load).toHaveBeenCalled();
    expect(component.notice).toContain('a fost ștearsă');
  });

  it('grupează notificările de pontaj pe zi și numără angajații o singură dată', () => {
    const component = new TeamsWorkspaceComponent({} as any, {} as any);
    component.attendanceAlerts = [
      { id: 1, date: '2026-09-22', team: { id: 1, name: 'Alfa' }, worksite: 'Bloc A', is_unseen: true, employees: [employee(1, 'Ana Pop', 'Dulgher'), employee(2, 'Ion Stan', 'Fierar')] },
      { id: 2, date: '2026-09-22', team: { id: 2, name: 'Beta' }, worksite: 'Bloc B2', is_unseen: false, employees: [employee(2, 'Ion Stan', 'Fierar'), employee(3, 'Mihai Dan', 'Sudor')] },
      { id: 3, date: '2026-09-21', team: { id: 1, name: 'Alfa' }, worksite: 'Bloc A', is_unseen: false, employees: [employee(4, 'Dan Ene', 'Zidar')] },
    ] as any;

    const days = component.attendanceAlertsByDate;

    expect(days.map(item => item.date)).toEqual(['2026-09-22', '2026-09-21']);
    expect(days[0].employeeCount).toBe(3);
    expect(days[0].teamCount).toBe(2);
    expect(days[0].isUnseen).toBeTrue();
  });

  it('deschide și închide acordeonul unei zile de pontaj', () => {
    const component = new TeamsWorkspaceComponent({} as any, {} as any);

    component.toggleAttendanceDate('2026-09-22');
    expect(component.isAttendanceDateExpanded('2026-09-22')).toBeTrue();

    component.toggleAttendanceDate('2026-09-22');
    expect(component.isAttendanceDateExpanded('2026-09-22')).toBeFalse();
  });

  it('separă tipurile de notificări în taburi și resetează căutarea', () => {
    const component = new TeamsWorkspaceComponent({} as any, {} as any);
    component.searchTerm = 'Popescu';

    component.setNotificationTab('leave');

    expect(component.notificationTab).toBe('leave');
    expect(component.searchTerm).toBe('');
  });
});
