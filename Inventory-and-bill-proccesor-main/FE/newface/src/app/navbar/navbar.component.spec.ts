import { EMPTY, of } from 'rxjs';
import { NavbarComponent, NavGroup } from './navbar.component';

describe('NavbarComponent module filtering', () => {
  function componentFor(modules: string[], admin = false): NavbarComponent {
    const router: any = { url: '/dashboard', events: EMPTY, navigateByUrl: jasmine.createSpy(), navigate: jasmine.createSpy() };
    const auth: any = {
      currentSession: () => admin
        ? ({ role: 'admin', auth_type: 'legacy' })
        : ({ role: 'app_user', auth_type: 'app_user', modules, permissions: [] }),
      firstAvailableModuleRoute: () => '/dashboard',
      logout: jasmine.createSpy()
    };
    const teamsApi: any = { getNotificationSummary: () => of({ attention_count: 0 }) };
    return new NavbarComponent(router, auth, teamsApi);
  }

  function visibleGroups(component: NavbarComponent): NavGroup[] {
    return component.groups.filter(group => component.visibleLinks(group).length > 0);
  }

  it('utilizatorul doar cu Echipe vede toate paginile categoriei', () => {
    const component = componentFor(['teams_schedule']);
    const groups = visibleGroups(component);
    expect(groups.map(group => group.label)).toEqual(['Echipe și program']);
    expect(component.visibleLinks(groups[0]).map(link => link.path)).toEqual([
      '/pontaj/echipe', '/pontaj/echipa-mea', '/pontaj/concedii', '/pontaj/echipe-azi', '/pontaj/personal', '/pontaj/notificari'
    ]);
  });

  it('utilizatorul doar cu Pontaj vede toate cele șase pagini', () => {
    const component = componentFor(['attendance']);
    const groups = visibleGroups(component);
    expect(groups.map(group => group.label)).toEqual(['Pontaj']);
    expect(component.visibleLinks(groups[0]).map(link => link.path)).toEqual([
      '/dashboard', '/pontaj', '/pontaj/rapoarte', '/pontaj/fisa-angajat', '/pontaj/organigrama', '/pontaj/cazari'
    ]);
  });

  it('utilizatorul doar cu Magazie vede toate cele patru pagini', () => {
    const component = componentFor(['warehouse']);
    const groups = visibleGroups(component);
    expect(groups.map(group => group.label)).toEqual(['Magazie']);
    expect(component.visibleLinks(groups[0]).map(link => link.path)).toEqual([
      '/magazie', '/magazie/scule', '/magazie/echipamente-ssm', '/magazie/istoric'
    ]);
  });

  it('nu mai afișează vechiul modul Resurse umane', () => {
    const component = componentFor(['human_resources']);
    expect(visibleGroups(component)).toEqual([]);
  });

  it('combină toate paginile pentru două module', () => {
    const component = componentFor(['attendance', 'teams_schedule']);
    const groups = visibleGroups(component);
    expect(groups.map(group => group.label)).toEqual(['Pontaj', 'Echipe și program']);
    expect(groups.reduce((count, group) => count + component.visibleLinks(group).length, 0)).toBe(12);
  });

  it('nu afișează categorii pentru un utilizator fără module', () => {
    expect(visibleGroups(componentFor([]))).toEqual([]);
  });

  it('administratorul vede toate categoriile și toate paginile', () => {
    const component = componentFor([], true);
    const groups = visibleGroups(component);
    expect(groups.map(group => group.label)).toEqual([
      'Pontaj', 'Echipe și program', 'Magazie', 'Unelte'
    ]);
    expect(groups.reduce((count, group) => count + component.visibleLinks(group).length, 0)).toBe(17);
  });

  it('marchează o singură rută de echipe ca activă', () => {
    const router: any = { url: '/pontaj/echipe-azi', events: EMPTY, navigateByUrl: jasmine.createSpy(), navigate: jasmine.createSpy() };
    const auth: any = { currentSession: () => ({ role: 'admin', auth_type: 'legacy' }), logout: jasmine.createSpy() };
    const teamsApi: any = { getNotificationSummary: () => of({ attention_count: 0 }) };
    const component = new NavbarComponent(router, auth, teamsApi);
    expect(component.groups[1].links.filter(link => link.active).map(link => link.path)).toEqual(['/pontaj/echipe-azi']);
  });
});
