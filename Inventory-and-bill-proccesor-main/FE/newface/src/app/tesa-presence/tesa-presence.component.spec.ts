import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TesaPresenceComponent } from './tesa-presence.component';

describe('TesaPresenceComponent', () => {
  let fixture: ComponentFixture<TesaPresenceComponent>;
  let component: TesaPresenceComponent;
  let http: HttpTestingController;
  let router: { navigateByUrl: jasmine.Spy };
  const api = window.location.origin + '/api/team-portal/tesa-presence/';
  const site = { name: 'Birou ingineri & TESA', latitude: 45.8, longitude: 24.1, radius_meters: 100 };
  const state = {
    employee: { name: 'TESA Test' }, work_date: '2026-01-11', worksites: [site], session: null,
    state: 'not_checked_in', can_check_in: true, can_check_out: false, can_confirm: true, blocked_reason: null,
  };
  const openSession = {
    work_date: state.work_date, worksite: site.name, in_time: '2026-01-11T08:17:00+02:00',
    out_time: null, hours: 0, state: 'open',
  };
  const closedSession = {
    ...openSession, out_time: '2026-01-11T16:42:00+02:00', hours: 8.42, state: 'closed',
  };

  beforeEach(async () => {
    router = { navigateByUrl: jasmine.createSpy() };
    await TestBed.configureTestingModule({ declarations: [TesaPresenceComponent], imports: [FormsModule, HttpClientTestingModule],
      providers: [{ provide: Router, useValue: router }] }).compileComponents();
    fixture = TestBed.createComponent(TesaPresenceComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); http.verify(); });

  it('face check-in cu GPS proaspăt și fără selfie', () => {
    http.expectOne(api).flush(state);
    component.worksite = site.name;
    let accept!: PositionCallback;
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(callback => { accept = callback; });
    component.confirm();
    component.confirm();
    expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    http.expectNone(api);
    accept({ coords: { latitude: 45.8, longitude: 24.1, accuracy: 9 }, timestamp: Date.now() } as GeolocationPosition);
    const post = http.expectOne(api);
    expect(post.request.method).toBe('POST');
    expect(Object.keys(post.request.body).sort()).toEqual(['action', 'gps', 'worksite']);
    expect(post.request.body.action).toBe('check_in');
    expect(post.request.body.gps.accuracy).toBe(9);
    post.flush({ session: openSession });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ești pontat');
    expect(fixture.nativeElement.textContent).toContain('Pontează ieșirea');
    expect(fixture.nativeElement.textContent).toContain('08:17');
    expect(fixture.nativeElement.querySelector('video')).toBeNull();
  });

  it('face check-out pentru sesiunea activă și salvează orele reale', () => {
    http.expectOne(api).flush({
      ...state, session: openSession, state: 'checked_in',
      can_check_in: false, can_check_out: true, can_confirm: true,
    });
    fixture.detectChanges();
    expect(component.worksite).toBe(site.name);
    expect(fixture.nativeElement.textContent).toContain('Pontează ieșirea');
    let accept!: PositionCallback;
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(callback => { accept = callback; });
    component.confirm();
    accept({ coords: { latitude: 45.8, longitude: 24.1, accuracy: 7 }, timestamp: Date.now() } as GeolocationPosition);
    const post = http.expectOne(api);
    expect(post.request.body.action).toBe('check_out');
    expect(post.request.body.worksite).toBe(site.name);
    post.flush({ session: closedSession });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pontaj încheiat');
    expect(fixture.nativeElement.textContent).toContain('08:17 – 16:42');
    expect(fixture.nativeElement.querySelector('video')).toBeNull();
  });

  it('arată distanța față de șantier și permite confirmarea din afara perimetrului', () => {
    http.expectOne(api).flush(state);
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(callback =>
      callback({ coords: { latitude: 45.81, longitude: 24.2, accuracy: 12 }, timestamp: Date.now() } as GeolocationPosition));
    component.worksite = site.name;
    component.worksiteChanged();
    fixture.detectChanges();
    expect(component.insidePerimeter).toBeFalse();
    expect(component.distanceMeters).toBeGreaterThan(site.radius_meters);
    expect(fixture.nativeElement.textContent).toContain('În afara perimetrului');
    expect(fixture.nativeElement.querySelector('.confirm-button').disabled).toBeFalse();
    component.confirm();
    const post = http.expectOne(api);
    expect(post.request.body.gps.lat).toBe(45.81);
    post.flush({ session: { ...openSession, distance_m: 5400, inside_perimeter: false } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ești pontat');
  });

  it('nu salvează pontajul când locația este refuzată', () => {
    http.expectOne(api).flush(state);
    component.worksite = site.name;
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((_success, failure) => failure!({ code: 1 } as GeolocationPositionError));
    component.confirm();
    expect(component.error).toContain('refuzat');
    expect(component.saving).toBeFalse();
    http.expectNone(api);
  });

  it('reîncărcarea păstrează sesiunea activă și oferă check-out', () => {
    http.expectOne(api).flush({
      ...state, session: openSession, state: 'checked_in',
      can_check_in: false, can_check_out: true, can_confirm: true,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ești pontat');
    expect(fixture.nativeElement.textContent).toContain('Pontează ieșirea');
    expect(component.action).toBe('check_out');
    expect(component.worksite).toBe(site.name);
  });

  it('redirecționează dacă accesul TESA a fost retras', () => {
    http.expectOne(api).flush({ error: 'Interzis' }, { status: 403, statusText: 'Forbidden' });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/team-dashboard');
  });
});
