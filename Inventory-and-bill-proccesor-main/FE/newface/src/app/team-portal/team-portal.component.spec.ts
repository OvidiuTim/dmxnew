import { Location } from '@angular/common';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { TeamPortalComponent } from './team-portal.component';

describe('TeamPortalComponent performance regressions', () => {
  let fixture: ComponentFixture<TeamPortalComponent>;
  let component: TeamPortalComponent;
  let http: HttpTestingController;
  const route = { snapshot: { data: { portalView: 'personnel' }, queryParamMap: { get: () => null } } };
  const api = window.location.origin + '/api/team-portal';

  beforeEach(async () => {
    route.snapshot.data.portalView = 'personnel';
    await TestBed.configureTestingModule({
      declarations: [TeamPortalComponent],
      imports: [FormsModule, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: { currentSession: () => ({ roles: ['supervisor'] }) } },
        { provide: ActivatedRoute, useValue: route },
        { provide: Router, useValue: {} },
        { provide: Location, useValue: {} },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TeamPortalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => { fixture.destroy(); http.verify(); });

  function person(id: number, teamId: number | null = 7) {
    return { id, name: `Angajat ${id}`, serie: `S-${id}`, company: 'DMX', team: teamId === null ? null : { id: teamId, name: 'Echipa' } };
  }

  it('afișează confirmarea prezenței numai personalului TESA', () => {
    route.snapshot.data.portalView = 'home';
    fixture.detectChanges();
    http.expectOne(`${api}/dashboard/`).flush({
      employee: { name: 'TESA', is_tesa: true },
      attendance: { is_clocked_in: false, started_at: null },
      unread_notifications: 0,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tesa-card')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.attendance-card').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.attendance-card.clocked-out')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.attendance-card small').textContent).toContain('Nu ești pontat astăzi');
    component.dashboard.employee.is_tesa = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tesa-card')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.attendance-card').length).toBe(1);
  });

  it('afișează verde timpul scurs de la check-in', () => {
    route.snapshot.data.portalView = 'home';
    spyOn(Date, 'now').and.returnValue(Date.parse('2026-09-17T12:15:00+03:00'));
    fixture.detectChanges();
    http.expectOne(`${api}/dashboard/`).flush({
      employee: { name: 'Șofer', is_tesa: false, is_driver: true },
      attendance: { is_clocked_in: true, started_at: '2026-09-17T10:10:00+03:00' },
      unread_notifications: 0,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.attendance-card.clocked-in')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.attendance-card small').textContent).toContain('Ești pontat de 2 ore 5 minute');
  });

  it('afișează cardul și ierarhia echipei pentru un membru fără rol de șef', () => {
    route.snapshot.data.portalView = 'home';
    fixture.detectChanges();
    http.expectOne(`${api}/dashboard/`).flush({
      employee: { id: 5, name: 'Membru', is_tesa: false },
      can_view_my_team: true,
      is_team_leader: false,
      is_supervisor: false,
      attendance: { is_clocked_in: false, started_at: null },
      unread_notifications: 0,
    });
    fixture.detectChanges();
    const teamCard = Array.from(fixture.nativeElement.querySelectorAll('.action-card'))
      .find((card: any) => card.textContent.includes('Echipa mea')) as HTMLElement;
    expect(teamCard).toBeTruthy();
    fixture.destroy();

    route.snapshot.data.portalView = 'team';
    fixture = TestBed.createComponent(TeamPortalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne(`${api}/teams/`).flush({
      teams: [{
        id: 7,
        name: 'Confecții Metalice',
        can_manage: false,
        supervisor: { id: 1, name: 'Supervisor', trade: 'Supervisor', status: 'present', is_current_user: false },
        leader: { id: 2, name: 'Șef Echipă', trade: 'Sudor', status: 'present', is_current_user: false },
        members: [{ id: 5, name: 'Membru', trade: 'Sudor', status: 'present', is_current_user: true }],
      }],
      can_mark_absent: false,
    });
    http.expectOne(`${api}/notifications/summary/`).flush({ unread_count: 0 });
    fixture.detectChanges();
    const hierarchy = fixture.nativeElement.querySelector('.team-hierarchy');
    expect(hierarchy.textContent).toContain('Supervisor');
    expect(hierarchy.textContent).toContain('Șef Echipă');
    expect(fixture.nativeElement.textContent).toContain('Membru');
    expect(fixture.nativeElement.textContent).toContain('Tu');
    expect(fixture.nativeElement.querySelector('.team-title button')).toBeNull();
  });

  it('traduce statusul pontajului făcut după pragul de 08:10', () => {
    component.language = 'ro';
    expect(component.statusLabel('late')).toBe('Pontat după 08:10');
    expect(component.statusIcon('late')).toBe('schedule');
  });

  it('opens a large personnel accordion and settles ngModel without rebuilding its DOM', fakeAsync(() => {
    fixture.detectChanges();
    http.expectOne(`${api}/personnel/`).flush({
      employees: Array.from({ length: 250 }, (_, index) => person(index + 1)),
      teams: [{ id: 8, name: 'Destinație' }],
    });
    // Detail content must be usable even while the notification badge is still loading.
    expect(component.loading).toBeFalse();
    http.expectNone(`${api}/dashboard/`);
    fixture.detectChanges();
    const groups = component.personnelGroups;
    (fixture.nativeElement.querySelector('.team-accordion-header') as HTMLButtonElement).click();
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('.personnel-row select') as HTMLSelectElement;
    expect(fixture.nativeElement.querySelectorAll('.personnel-row').length).toBe(250);
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
    expect(component.personnel[0].destination_team_id).toBe(8);
    expect(component.personnelGroups).toBe(groups);
    expect(fixture.nativeElement.querySelector('.personnel-row select')).toBe(select);
    http.expectOne(`${api}/notifications/summary/`).flush({ unread_count: 2 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.personnel-row select')).toBe(select);
    fixture.destroy();
  }));

  it('keeps team identity when searching and invalidates groups after reload or language change', () => {
    component.personnel = [person(1, 7), person(2, 8), person(3, null)];
    expect(component.personnelGroups.length).toBe(3); // Same name, different team IDs.
    component.toggleTeam(8);
    component.personnelSearch = 'Angajat 2';
    expect(component.personnelGroups.map(group => group.id)).toEqual([8]);
    expect(component.openTeamId).toBe(8);
    component.personnelSearch = '';
    component.language = 'ro';
    expect(component.personnelGroups[2].name).toBe(component.t.noTeam);
    component.personnel = [person(4, 9)];
    expect(component.personnelGroups.map(group => group.id)).toEqual([9]);
  });

  it('loads a supervisor home only once and polls only the badge afterwards', fakeAsync(() => {
    route.snapshot.data.portalView = 'home';
    fixture.detectChanges();
    http.expectOne(`${api}/dashboard/`).flush({ employee: { name: 'Supervisor' }, is_supervisor: true, unread_notifications: 3 });
    http.expectNone(`${api}/notifications/summary/`);
    tick(15000);
    http.expectOne(`${api}/notifications/summary/`).flush({ unread_count: 4 });
    http.expectNone(`${api}/dashboard/`);
    expect(component.unreadCount).toBe(4);
    fixture.destroy();
  }));

  it('cancels pending page requests when leaving the portal', () => {
    fixture.detectChanges();
    const page = http.expectOne(`${api}/personnel/`);
    const summary = http.expectOne(`${api}/notifications/summary/`);
    fixture.destroy();
    expect(page.cancelled).toBeTrue();
    expect(summary.cancelled).toBeTrue();
  });
});
