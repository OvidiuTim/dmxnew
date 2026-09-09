import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { ConstructionSitesComponent } from './construction-sites.component';

const emptyCosts = () => ({ seconds: 0, hours: '0.00', labor_cost: '0.00', expense_cost: '0.00', total_cost: '0.00',
  employee_count: 0, open_sessions: 0, estimated_seconds: 0, missing_rate_seconds: 0, employees: [], points: [], categories: [] });
const response = () => ({ sites: [], totals: emptyCosts(), unallocated: emptyCosts(), unallocated_lifetime: emptyCosts(),
  can_manage: true, categories: [{ value: 'materials', label: 'Materiale' }], points: [
    { name: 'Psihiatrie C8', is_primary: true, latitude: 45.80720228440877, longitude: 24.15440514734915, site_id: null, site_name: null,
      history: { name: 'Psihiatrie C8', hours: '8.00', seconds: 28800, cost: '200.00', open_sessions: 0 } },
    { name: 'Psihiatrie C16', is_primary: true, latitude: 45.8076, longitude: 24.157, site_id: 9, site_name: 'Alt șantier' }
  ] });

describe('ConstructionSitesComponent', () => {
  let fixture: ComponentFixture<ConstructionSitesComponent>;
  let component: ConstructionSitesComponent;
  let http: HttpTestingController;
  const isCollection = (request: any) => request.url.endsWith('/api/construction-sites/');
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConstructionSitesComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({})) } }]
    }).compileComponents();
    fixture = TestBed.createComponent(ConstructionSitesComponent); component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges(); http.expectOne(isCollection).flush(response()); fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); http.verify(); });

  it('opens the real dialog and imports the chosen point coordinates and history', fakeAsync(() => {
    component.edit(); fixture.detectChanges(); tick();
    const dialog = fixture.nativeElement.querySelector('#site-dialog-title').closest('dialog');
    expect(dialog.open).toBeTrue();
    const checkboxes = dialog.querySelectorAll('.point-picker input');
    expect(checkboxes[1].disabled).toBeTrue();
    checkboxes[0].click(); fixture.detectChanges(); tick();
    expect(component.form.name).toBe('Psihiatrie C8');
    expect(component.form.latitude).toBe(45.80720228440877);
    expect(component.form.points).toEqual(['Psihiatrie C8']);
    expect(component.importedHours).toBe(8);
    expect(component.importedCost).toBe(200);
    expect(dialog.querySelector('.import-preview').textContent).toContain('200,00');
    component.closeDialog(dialog);
  }));

  it('saves the point link without passing derived cost values', fakeAsync(() => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.edit(undefined, component.data!.points[0]); fixture.detectChanges(); tick();
    component.saveSite();
    const request = http.expectOne(isCollection);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.points).toEqual(['Psihiatrie C8']);
    expect(request.request.body.start_date).toBeNull();
    expect(request.request.body.costs).toBeUndefined();
    request.flush({ site: { id: 10 } });
    tick(); expect(navigate).toHaveBeenCalledWith(['/santiere', 10]);
    expect(component.saving).toBeFalse();
  }));

  it('keeps unsaved data visible after a server conflict', fakeAsync(() => {
    component.edit(undefined, component.data!.points[0]); fixture.detectChanges(); tick();
    component.saveSite();
    http.expectOne(isCollection).flush({ error: 'Punctul a fost asociat între timp.' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(component.formError).toContain('între timp');
    expect(component.form.points).toEqual(['Psihiatrie C8']);
    expect(component.siteDialog.nativeElement.open).toBeTrue();
    component.closeDialog(component.siteDialog.nativeElement);
  }));

  it('rejects reversed dates without replacing the loaded report', () => {
    component.start = '2026-09-08'; component.end = '2026-09-01';
    component.load(); http.expectNone(isCollection);
    expect(component.error).toContain('Data de început');
    expect(component.data?.points.length).toBe(2);
  });

  it('uses an empty date range for all historical costs', () => {
    component.allHistory();
    const request = http.expectOne(isCollection);
    expect(request.request.params.has('start')).toBeFalse();
    expect(request.request.params.has('end')).toBeFalse();
    request.flush(response());
    expect(component.appliedStart).toBe('');
  });

  it('hides writes for read-only access while keeping reports available', () => {
    component.data!.can_manage = false; fixture.detectChanges();
    const text = fixture.nativeElement.querySelector('.sites-page').textContent;
    expect(text).not.toContain('Șantier nou');
    expect(text).not.toContain('Importă punctele principale');
    expect(text).toContain('Export costuri');
  });

  it('cancels an older in-flight report when the date filter changes', () => {
    component.load(); const old = http.expectOne(isCollection);
    component.end = '2026-08-31'; component.start = '2026-08-01'; component.load();
    expect(old.cancelled).toBeTrue();
    const latest = http.expectOne(isCollection); latest.flush(response());
    expect(component.appliedEnd).toBe('2026-08-31');
  });
});
