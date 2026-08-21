import { OrganizationComponent } from './organization.component';
import { of } from 'rxjs';

describe('OrganizationComponent', () => {
  const department = (id: number, children: any[] = []): any => ({
    id, name: `Departament ${id}`, subtitle: '', color: '#35dfa6', parent_id: null,
    sort_order: id, members: [], children,
  });

  it('păstrează starea acordeonului fiecărui departament independent', () => {
    const component = new OrganizationComponent({} as any, {} as any);
    const first = department(10);

    expect(component.isDepartmentCollapsed(10)).toBeFalse();
    component.toggleDepartment(first);
    expect(component.isDepartmentCollapsed(10)).toBeTrue();
    expect(component.isDepartmentCollapsed(20)).toBeFalse();
    component.toggleDepartment(first);
    expect(component.isDepartmentCollapsed(10)).toBeFalse();
  });

  it('închide recursiv subgrupele și le păstrează închise la redeschiderea părintelui', () => {
    const component = new OrganizationComponent({} as any, {} as any);
    const tree = department(1, [department(2, [department(3)])]);

    component.toggleDepartment(tree);

    expect(component.isDepartmentCollapsed(1)).toBeTrue();
    expect(component.isDepartmentCollapsed(2)).toBeTrue();
    expect(component.isDepartmentCollapsed(3)).toBeTrue();

    component.toggleDepartment(tree);

    expect(component.isDepartmentCollapsed(1)).toBeFalse();
    expect(component.isDepartmentCollapsed(2)).toBeTrue();
    expect(component.isDepartmentCollapsed(3)).toBeTrue();
  });

  it('transformă o grupă cu angajați asociați într-o echipă permanentă', () => {
    const response: any = {
      roots: [], departments: [], members: [], employees: [],
      summary: { departments: 0, members: 0, associated: 0, unassociated: 0 }, can_manage: true,
    };
    const api = { convertDepartmentToTeam: jasmine.createSpy().and.returnValue(of({ organization: response })) } as any;
    const component = new OrganizationComponent(api, {} as any);
    const group = {
      ...department(8), team: null,
      members: [{ id: 1, name: 'Ion Lider', role: 'Șef de echipă', associated: true, employee: { id: 11, active: true } }],
    } as any;

    component.openTeamDialog(group);
    component.convertToTeam();

    expect(api.convertDepartmentToTeam).toHaveBeenCalledWith(8, { leader_id: 11, supervisor_id: 11 });
    expect(component.teamDialogOpen).toBeFalse();
    expect(component.notice).toContain('sincronizată');
  });
});
