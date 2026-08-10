import { EMPTY } from 'rxjs';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  it('afișează structura nouă pentru echipe și program în ordinea cerută', () => {
    const router: any = { url: '/dashboard', events: EMPTY, navigateByUrl: jasmine.createSpy('navigateByUrl'), navigate: jasmine.createSpy('navigate') };
    const auth: any = { currentSession: () => ({ role: 'admin', auth_type: 'legacy' }), logout: jasmine.createSpy('logout') };
    const component = new NavbarComponent(router, auth);

    expect(component.groups.map(group => group.label)).toEqual([
      'General', 'Pontaj', 'Echipe și program', 'Magazie', 'Resurse umane'
    ]);
    expect(component.groups[2].links.map(link => link.label)).toEqual([
      'Echipe permanente', 'Echipele de azi', 'Personal disponibil', 'Concedii'
    ]);
    expect(component.groups[2].links.map(link => link.path)).toEqual([
      '/pontaj/echipe', '/pontaj/echipe-azi', '/pontaj/personal-disponibil', '/pontaj/concedii'
    ]);
  });

  it('marchează o singură rută de echipe ca activă', () => {
    const router: any = { url: '/pontaj/echipe-azi', events: EMPTY, navigateByUrl: jasmine.createSpy('navigateByUrl'), navigate: jasmine.createSpy('navigate') };
    const auth: any = { currentSession: () => ({ role: 'admin', auth_type: 'legacy' }), logout: jasmine.createSpy('logout') };
    const component = new NavbarComponent(router, auth);
    const links = component.groups[2].links;
    expect(links.filter(link => link.active).map(link => link.path)).toEqual(['/pontaj/echipe-azi']);
  });
});
