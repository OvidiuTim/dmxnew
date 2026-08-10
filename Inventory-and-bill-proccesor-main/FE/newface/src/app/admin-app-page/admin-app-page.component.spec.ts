import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminAppPageComponent, AdminModuleDefinition } from './admin-app-page.component';
import { AuthService } from '../auth/auth.service';

describe('AdminAppPageComponent modules', () => {
  const modules: AdminModuleDefinition[] = [
    { code: 'attendance', label: 'Pontaj', description: '', icon: 'schedule', main_route: '/pontaj' },
    { code: 'teams_schedule', label: 'Echipe și program', description: '', icon: 'groups', main_route: '/pontaj/echipe' },
    { code: 'warehouse', label: 'Magazie', description: '', icon: 'warehouse', main_route: '/magazie' },
    { code: 'human_resources', label: 'Resurse umane', description: '', icon: 'description', main_route: '/hr/documente' },
    { code: 'tools', label: 'Unelte', description: '', icon: 'construction', main_route: '/unelte' }
  ];

  it('afișează cele cinci carduri în pagină', async () => {
    const auth = {
      adminAppVerify: () => of({ ok: true }),
      getAdminModules: () => of({ modules, routes: [], users: [] })
    };
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule],
      declarations: [AdminAppPageComponent],
      providers: [{ provide: AuthService, useValue: auth }]
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminAppPageComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.module-card').length).toBe(5);
  });

  it('încarcă exact cele cinci module și salvează selecția multiplă', () => {
    const users = [
      { id: 1, username: 'ana', employee: { name: 'Ana' }, module_access: { attendance: true } },
      { id: 2, username: 'ion', employee: { name: 'Ion' }, module_access: { attendance: false } }
    ];
    const auth: any = {
      getAdminModules: () => of({ modules, routes: [], users }),
      saveAdminModuleAccess: jasmine.createSpy('saveAdminModuleAccess').and.callFake((_code: string, ids: number[]) => of({
        users: users.map(user => ({ ...user, module_access: { attendance: ids.includes(user.id) } }))
      }))
    };
    const component = new AdminAppPageComponent(auth);
    component.loadData();
    expect(component.modules.map(item => item.code)).toEqual(modules.map(item => item.code));
    component.toggleModuleUser('attendance', component.users[1], true);
    component.saveModule(modules[0]);
    expect(auth.saveAdminModuleAccess).toHaveBeenCalledWith('attendance', [1, 2]);
    component.toggleModuleUser('attendance', component.users[0], false);
    component.saveModule(modules[0]);
    expect(auth.saveAdminModuleAccess).toHaveBeenCalledWith('attendance', [2]);
  });
});
