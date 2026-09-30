import { FormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, Subject } from 'rxjs';
import { SharedService } from '../shared.service';
import { FleetAdminComponent } from './fleet-admin.component';

describe('FleetAdminComponent', () => {
  let fixture: ComponentFixture<FleetAdminComponent>;
  let component: FleetAdminComponent;
  let expirations$: Subject<any>;
  let documentTypes$: Subject<any>;
  let api: {
    getFleetDashboard: jasmine.Spy;
    getFleetExpirations: jasmine.Spy;
    getFleetDocumentTypes: jasmine.Spy;
  };

  beforeEach(async () => {
    expirations$ = new Subject<any>();
    documentTypes$ = new Subject<any>();
    api = {
      getFleetDashboard: jasmine.createSpy('getFleetDashboard'),
      getFleetExpirations: jasmine.createSpy('getFleetExpirations').and.returnValue(expirations$),
      getFleetDocumentTypes: jasmine.createSpy('getFleetDocumentTypes').and.returnValue(documentTypes$),
    };
    await TestBed.configureTestingModule({
      declarations: [FleetAdminComponent],
      imports: [FormsModule, RouterTestingModule],
      providers: [
        { provide: SharedService, useValue: api },
      ],
    }).compileComponents();

    TestBed.inject(ActivatedRoute).snapshot.data = { fleetTab: 'expirations' };
    fixture = TestBed.createComponent(FleetAdminComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    expirations$.complete();
    documentTypes$.complete();
    fixture.destroy();
  });

  it('încarcă pagina Expirări direct, fără să aștepte dashboardul flotei', () => {
    fixture.detectChanges();

    expect(api.getFleetDashboard).not.toHaveBeenCalled();
    expect(api.getFleetExpirations).toHaveBeenCalledTimes(1);
    expect(api.getFleetDocumentTypes).toHaveBeenCalledTimes(1);
    expect(component.loading).toBeFalse();

    expirations$.next({
      rows: [{ id: 1, group: '7' }],
      authorizations: [{ id: 2, group: '30' }],
    });
    documentTypes$.next({
      types: [{ id: 3, name: 'ITP' }],
      employee_document_types: [{ id: 4, name: 'Permis' }],
    });

    expect(component.expirations.length).toBe(1);
    expect(component.authorizationExpirations.length).toBe(1);
    expect(component.documentTypes[0].name).toBe('ITP');
    expect(component.employeeDocumentTypes[0].name).toBe('Permis');
  });

  it('păstrează datele disponibile dacă unul dintre requesturi eșuează', () => {
    fixture.detectChanges();

    documentTypes$.error({ error: { error: 'Tipurile de documente nu au putut fi încărcate.' } });
    expirations$.next({ rows: [{ id: 10, group: 'expired' }], authorizations: [] });

    expect(component.error).toContain('Tipurile de documente nu au putut fi încărcate');
    expect(component.expirations).toEqual([{ id: 10, group: 'expired' }]);
    expect(component.loading).toBeFalse();
  });

  it('păstrează secțiunile și câmpurile de reînnoire între verificările Angular', () => {
    fixture.detectChanges();
    expirations$.next({ rows: [{ id: 1, group: '7', equipment: 'U1', type: 'ITP' }], authorizations: [] });
    fixture.detectChanges();

    const groups = Array.from(fixture.nativeElement.querySelectorAll('.expiry-group'));
    const dateInput = fixture.nativeElement.querySelector('.renew-row input[type="date"]');
    const fileInput = fixture.nativeElement.querySelector('.renew-row input[type="file"]');
    expect(groups.length).toBe(4);
    expect(dateInput).not.toBeNull();
    dateInput.value = '2027-01-01';
    dateInput.dispatchEvent(new Event('input'));

    for (let cycle = 0; cycle < 5; cycle++) fixture.detectChanges();

    const updatedGroups = fixture.nativeElement.querySelectorAll('.expiry-group');
    groups.forEach((group, index) => expect(updatedGroups[index]).toBe(group));
    expect(fixture.nativeElement.querySelector('.renew-row input[type="date"]')).toBe(dateInput);
    expect(fixture.nativeElement.querySelector('.renew-row input[type="file"]')).toBe(fileInput);
    expect(component.expirations[0].renewDate).toBe('2027-01-01');
  });

  it('afișează documentele și autorizațiile pe termene și actualizează listele la reîncărcare', async () => {
    fixture.detectChanges();
    expirations$.next({
      rows: [
        { id: 1, group: 'expired', equipment: 'U1', type: 'ITP' },
        { id: 2, group: '7', equipment: 'U2', type: 'RCA' },
        { id: 3, group: '30', equipment: 'U3', type: 'ITP' },
        { id: 4, group: '60', equipment: 'U4', type: 'RCA' },
        { id: 5, group: 'later', equipment: 'U5', type: 'ITP' },
      ],
      authorizations: [{ id: 6, group: '7', employee_id: 10, employee: 'Operator', type: 'Permis' }],
    });
    expirations$.complete();
    documentTypes$.complete();
    fixture.autoDetectChanges();
    await fixture.whenStable();

    const groups = fixture.nativeElement.querySelectorAll('.expiry-group');
    expect(Array.from(groups).map((group: any) => group.querySelector('header > strong').textContent.trim()))
      .toEqual(['1', '2', '1', '1']);
    expect(groups[0].textContent).toContain('U1 · ITP');
    expect(groups[1].textContent).toContain('U2 · RCA');
    expect(groups[1].textContent).toContain('Operator · Permis');
    expect(groups[1].querySelector('a').getAttribute('href')).toBe('/pontaj/fisa-angajat/10');
    expect(fixture.nativeElement.textContent).not.toContain('U5');

    api.getFleetExpirations.and.returnValue(of({ rows: [], authorizations: [] }));
    api.getFleetDocumentTypes.and.returnValue(of({ types: [], employee_document_types: [] }));
    component.loadExpirations();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.renew-row').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.expiry-group .empty').length).toBe(4);
  });
});
