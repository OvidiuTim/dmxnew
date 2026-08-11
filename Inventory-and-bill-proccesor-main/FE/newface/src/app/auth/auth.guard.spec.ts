import { firstValueFrom, of } from 'rxjs';
import { AuthGuard } from './auth.guard';

describe('AuthGuard module access', () => {
  function setup(session: any) {
    const auth: any = {
      verifySession: jasmine.createSpy('verifySession').and.returnValue(of(session)),
      firstAvailableModuleRoute: jasmine.createSpy('firstAvailableModuleRoute').and.callFake((value: any) => value.default_module_route || null)
    };
    const router: any = {
      parseUrl: jasmine.createSpy('parseUrl').and.callFake((url: string) => ({ redirectedTo: url })),
      createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((commands: string[], extras?: any) => ({ commands, extras }))
    };
    return { guard: new AuthGuard(auth, router), auth, router };
  }

  it('redirectează /pontaj către primul modul disponibil', async () => {
    const { guard, router } = setup({ role: 'app_user', auth_type: 'app_user', modules: ['tools'], default_module_route: '/unelte', can_access_module: false });
    const result: any = await firstValueFrom(guard.canActivate({ data: { permissionRoute: '/pontaj', moduleCode: 'attendance', moduleEntry: true } } as any));
    expect(result.redirectedTo).toBe('/unelte');
    expect(router.parseUrl).toHaveBeenCalledWith('/unelte');
  });

  it('redirectează /pontaj către Echipe pentru un utilizator doar cu Echipe', async () => {
    const { guard } = setup({ role: 'app_user', auth_type: 'app_user', modules: ['teams_schedule'], default_module_route: '/pontaj/echipe', can_access_module: false });
    const result: any = await firstValueFrom(guard.canActivate({ data: { permissionRoute: '/pontaj', moduleCode: 'attendance', moduleEntry: true } } as any));
    expect(result.redirectedTo).toBe('/pontaj/echipe');
  });

  it('afișează starea fără module fără buclă de redirect', async () => {
    const { guard, router } = setup({ role: 'app_user', auth_type: 'app_user', modules: [], default_module_route: null, can_access_module: false });
    await firstValueFrom(guard.canActivate({ data: { permissionRoute: '/pontaj', moduleCode: 'attendance', moduleEntry: true } } as any));
    expect(router.createUrlTree).toHaveBeenCalledWith(['/no-access'], { queryParams: { reason: 'no-modules' } });
  });

  it('blochează URL-ul manual dacă modulul lipsește', async () => {
    const { guard, router } = setup({ role: 'app_user', auth_type: 'app_user', modules: ['teams_schedule'], can_access_module: false });
    await firstValueFrom(guard.canActivate({ data: { permissionRoute: '/magazie', moduleCode: 'warehouse' } } as any));
    expect(router.createUrlTree).toHaveBeenCalledWith(['/no-access']);
  });

  it('păstrează permisiunea granulară pentru o rută sensibilă', async () => {
    const { guard, router } = setup({ role: 'app_user', auth_type: 'app_user', modules: ['attendance'], can_access_module: true, can_access: false });
    await firstValueFrom(guard.canActivate({ data: { permissionRoute: '/users/new', moduleCode: 'attendance', requiresGranular: true } } as any));
    expect(router.createUrlTree).toHaveBeenCalledWith(['/no-access']);
  });

  it('permite o pagină standard a modulului chiar fără permisiune granulară', async () => {
    const { guard } = setup({ role: 'app_user', auth_type: 'app_user', modules: ['attendance'], can_access_module: true, can_access: false });
    const result = await firstValueFrom(guard.canActivate({ data: { permissionRoute: '/pontaj/rapoarte', moduleCode: 'attendance' } } as any));
    expect(result).toBeTrue();
  });

  it('permite refresh direct pe o rută validă fără redirect', async () => {
    const { guard, router } = setup({ role: 'app_user', auth_type: 'app_user', modules: ['teams_schedule'], can_access_module: true, can_access: true });
    const result = await firstValueFrom(guard.canActivate({ data: { permissionRoute: '/pontaj/echipe', moduleCode: 'teams_schedule' } } as any));
    expect(result).toBeTrue();
    expect(router.parseUrl).not.toHaveBeenCalled();
  });

  it('nu redirecționează în buclă când Pontaj este deja permis', async () => {
    const { guard, router } = setup({ role: 'app_user', auth_type: 'app_user', modules: ['attendance'], can_access_module: true, can_access: true });
    const result = await firstValueFrom(guard.canActivate({ data: { permissionRoute: '/pontaj', moduleCode: 'attendance', moduleEntry: true } } as any));
    expect(result).toBeTrue();
    expect(router.parseUrl).not.toHaveBeenCalled();
  });

  it('permite accesarea directă și refreshul tuturor rutelor standard', async () => {
    const standardRoutes = [
      { moduleCode: 'attendance', permissionRoute: '/dashboard' },
      { moduleCode: 'attendance', permissionRoute: '/pontaj/cazari' },
      { moduleCode: 'attendance', permissionRoute: '/pontaj/rapoarte' },
      { moduleCode: 'attendance', permissionRoute: '/pontaj/fisa-angajat' },
      { moduleCode: 'attendance', permissionRoute: '/pontaj' },
      { moduleCode: 'teams_schedule', permissionRoute: '/pontaj/echipe' },
      { moduleCode: 'teams_schedule', permissionRoute: '/pontaj/echipa-mea' },
      { moduleCode: 'teams_schedule', permissionRoute: '/pontaj/concedii' },
      { moduleCode: 'teams_schedule', permissionRoute: '/pontaj/echipe-azi' },
      { moduleCode: 'teams_schedule', permissionRoute: '/pontaj/personal-disponibil' },
      { moduleCode: 'warehouse', permissionRoute: '/magazie' },
      { moduleCode: 'warehouse', permissionRoute: '/magazie/scule' },
      { moduleCode: 'warehouse', permissionRoute: '/magazie/echipamente-ssm' },
      { moduleCode: 'warehouse', permissionRoute: '/magazie/istoric' },
      { moduleCode: 'human_resources', permissionRoute: '/hr/documente' },
      { moduleCode: 'tools', permissionRoute: '/unelte' },
      { moduleCode: 'tools', permissionRoute: '/unelte/adauga-unealta' },
      { moduleCode: 'tools', permissionRoute: '/predare-unealta' }
    ];
    for (const data of standardRoutes) {
      const { guard } = setup({ role: 'app_user', auth_type: 'app_user', modules: [data.moduleCode], can_access_module: true, can_access: false });
      expect(await firstValueFrom(guard.canActivate({ data } as any))).withContext(data.permissionRoute).toBeTrue();
    }
  });
});
