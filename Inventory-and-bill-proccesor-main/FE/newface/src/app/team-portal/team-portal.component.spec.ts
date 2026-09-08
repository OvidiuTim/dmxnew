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
