import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TesaPresenceComponent } from './tesa-presence.component';

describe('TesaPresenceComponent', () => {
  let fixture: ComponentFixture<TesaPresenceComponent>;
  let component: TesaPresenceComponent;
  let http: HttpTestingController;
  let router: { navigateByUrl: jasmine.Spy };
  const api = window.location.origin + '/api/team-portal/tesa-presence/';
  const site = { name: 'Birou ingineri & TESA', latitude: 45.8, longitude: 24.1, radius_meters: 90 };
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

  it('face check-in cu GPS proaspăt, confirmă ora și revine la dashboard', fakeAsync(() => {
    http.expectOne(api).flush(state);
    expect(component.worksite).toBe(site.name);
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
    expect(fixture.nativeElement.textContent).toContain('Te-ai pontat la 08:17');
    expect(fixture.nativeElement.textContent).toContain('Te întoarcem la dashboard');
    expect(fixture.nativeElement.textContent).toContain('08:17');
    expect(fixture.nativeElement.querySelector('video')).toBeNull();
    tick(1800);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/team-dashboard');
  }));

  it('afișează punctul de lucru și selectează implicit Birou ingineri & TESA', fakeAsync(() => {
    http.expectOne(api).flush(state);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    expect(component.worksite).toBe('Birou ingineri & TESA');
    expect(fixture.nativeElement.querySelector('label[for="tesa-worksite"]').textContent)
      .toContain('Selectează punctul de lucru');
    expect(fixture.nativeElement.querySelector('#tesa-worksite').value).toBe('Birou ingineri & TESA');
    tick(1000);
  }));

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
    expect(component.action).toBe('check_in');
    expect(component.status?.can_check_in).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Te-ai depontat la 16:42');
    expect(fixture.nativeElement.textContent).toContain('Te întoarcem la dashboard');
    expect(fixture.nativeElement.querySelector('video')).toBeNull();
  });

  it('pentru TESA și șofer cere șantierul, permite exteriorul și salvează GPS fără selfie', () => {
    http.expectOne(api).flush({
      ...state,
      employee: { name: 'TESA Șofer', is_tesa: true, is_driver: true },
      unrestricted_location: true,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#tesa-worksite')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('video')).toBeNull();
    component.worksite = site.name;

    let accept!: PositionCallback;
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(callback => { accept = callback; });
    component.confirm();
    accept({ coords: { latitude: 46.1, longitude: 25.2, accuracy: 13 }, timestamp: Date.now() } as GeolocationPosition);
    const post = http.expectOne(api);
    expect(post.request.method).toBe('POST');
    expect(Object.keys(post.request.body).sort()).toEqual(['action', 'gps', 'worksite']);
    expect(post.request.body.action).toBe('check_in');
    expect(post.request.body.worksite).toBe(site.name);
    expect(post.request.body.gps.lat).toBe(46.1);
    post.flush({ session: openSession });
  });

  it('arată distanța și blochează TESA fără rol de șofer în afara perimetrului', () => {
    http.expectOne(api).flush(state);
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(callback =>
      callback({ coords: { latitude: 45.81, longitude: 24.2, accuracy: 12 }, timestamp: Date.now() } as GeolocationPosition));
    component.worksite = site.name;
    component.worksiteChanged();
    fixture.detectChanges();
    expect(component.insidePerimeter).toBeFalse();
    expect(component.distanceMeters).toBeGreaterThan(site.radius_meters);
    expect(fixture.nativeElement.textContent).toContain('În afara perimetrului');
    expect(fixture.nativeElement.querySelector('.confirm-button').disabled).toBeTrue();
    component.confirm();
    http.expectNone(api);
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

  it('după o ieșire permite imediat o intrare nouă în aceeași zi', () => {
    http.expectOne(api).flush({
      ...state, session: closedSession, state: 'checked_out',
      can_check_in: true, can_check_out: false, can_confirm: true,
    });
    fixture.detectChanges();
    expect(component.action).toBe('check_in');
    expect(fixture.nativeElement.textContent).toContain('Pontează intrarea');
    expect(fixture.nativeElement.textContent).not.toContain('Pontaj încheiat');
  });

  it('redirecționează dacă accesul TESA a fost retras', () => {
    http.expectOne(api).flush({ error: 'Interzis' }, { status: 403, statusText: 'Forbidden' });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/team-dashboard');
  });
});
