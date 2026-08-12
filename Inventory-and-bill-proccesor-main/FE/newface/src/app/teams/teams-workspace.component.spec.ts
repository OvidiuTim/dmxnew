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

  it('afișează întâi membrii echipei editate', () => {
    const component = new TeamsWorkspaceComponent({} as any, {} as any);
    const member = { ...employee(2, 'Zoe Membru', 'Fierar'), team: { id: 7, name: 'Echipa Verde' } };
    const available = employee(1, 'Ana Liberă', 'Dulgher');
    component.teamForm = { id: 7, leader_id: 2 } as any;
    component.employees = [available, member];

    expect(component.selectableMembers.map(item => item.id)).toEqual([2, 1]);
  });
});
