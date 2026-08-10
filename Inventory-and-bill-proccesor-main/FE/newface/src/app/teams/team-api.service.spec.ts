import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TeamApiService } from './team-api.service';

describe('TeamApiService', () => {
  let service: TeamApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(TeamApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('folosește endpointul situației zilnice cu data selectată', () => {
    service.getToday('2026-08-10').subscribe();
    const request = http.expectOne(`${window.location.origin}/api/teams/today/?date=2026-08-10`);
    expect(request.request.method).toBe('GET');
    request.flush({ date: '2026-08-10', teams: [], available: [] });
  });

  it('trimite acțiunea de aprobare pentru solicitare', () => {
    service.actOnRequest(7, 'approve').subscribe();
    const request = http.expectOne(`${window.location.origin}/api/teams/requests/7/action/`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ action: 'approve' });
    request.flush({ request: { id: 7, status: 'approved' } });
  });
});
