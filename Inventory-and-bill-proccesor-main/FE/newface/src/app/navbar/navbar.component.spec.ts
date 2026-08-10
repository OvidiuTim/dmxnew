import { EMPTY } from 'rxjs';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  it('afișează structura nouă pentru echipe și program în ordinea cerută', () => {
    const router: any = { url: '/dashboard', events: EMPTY, navigateByUrl: jasmine.createSpy('navigateByUrl'), navigate: jasmine.createSpy('navigate') };
    const auth: any = { currentSession: () => ({ role: 'admin', auth_type: 'legacy' }), logout: jasmine.createSpy('logout') };
    const component = new NavbarComponent(router, auth);

    expect(component.groups.map(group => group.label)).toEqual([
      'Pontaj', 'Echipe și program', 'Magazie', 'Resurse umane', 'Unelte'
    ]);
    expect(component.groups[1].links.map(link => link.label)).toEqual([
      'Echipe permanente', 'Echipele de azi', 'Personal disponibil'
    ]);
    expect(component.groups[1].links.map(link => link.path)).toEqual([
      '/pontaj/echipe', '/pontaj/echipe-azi', '/pontaj/personal-disponibil'
    ]);
  });

  it('marchează o singură rută de echipe ca activă', () => {
    const router: any = { url: '/pontaj/echipe-azi', events: EMPTY, navigateByUrl: jasmine.createSpy('navigateByUrl'), navigate: jasmine.createSpy('navigate') };
    const auth: any = { currentSession: () => ({ role: 'admin', auth_type: 'legacy' }), logout: jasmine.createSpy('logout') };
    const component = new NavbarComponent(router, auth);
    const links = component.groups[1].links;
    expect(links.filter(link => link.active).map(link => link.path)).toEqual(['/pontaj/echipe-azi']);
  });

  it('ascunde complet categoriile fără modul și fără titluri goale', () => {
    const router: any = { url: '/pontaj/echipe', events: EMPTY, navigateByUrl: jasmine.createSpy(), navigate: jasmine.createSpy() };
    const auth: any = {
      currentSession: () => ({ role: 'app_user', auth_type: 'app_user', modules: ['teams_schedule'], permissions: ['/pontaj/echipe'] }),
      firstAvailableModuleRoute: () => '/pontaj/echipe',
      logout: jasmine.createSpy()
    };
    const component = new NavbarComponent(router, auth);
    expect(component.visibleLinks(component.groups[0])).toEqual([]);
    expect(component.visibleLinks(component.groups[1]).map(link => link.path)).toEqual(['/pontaj/echipe']);
    expect(component.visibleLinks(component.groups[2])).toEqual([]);
  });
});
