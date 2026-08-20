import { TeamsWorkspaceComponent } from './teams-workspace.component';

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
});
