import { ToolsNavComponent } from './tools-nav.component';

describe('ToolsNavComponent', () => {
  function componentFor(session: any): ToolsNavComponent {
    const auth: any = { currentSession: () => session, moduleRoutes: {}, logout: jasmine.createSpy() };
    const router: any = { navigate: jasmine.createSpy() };
    return new ToolsNavComponent(auth, router);
  }

  it('afișează toate paginile standard pentru modulul tools fără permisiuni granulare', () => {
    const component = componentFor({ role: 'app_user', auth_type: 'app_user', modules: ['tools'], permissions: [] });
    expect(component.canRoute('/unelte')).toBeTrue();
    expect(component.canRoute('/unelte/adauga-unealta')).toBeTrue();
    expect(component.canRoute('/predare-unealta')).toBeTrue();
  });

  it('nu afișează interfața Unelte fără modul', () => {
    const component = componentFor({ role: 'app_user', auth_type: 'app_user', modules: [], permissions: ['/predare-unealta'] });
    expect(component.canRoute('/predare-unealta')).toBeFalse();
  });
});
