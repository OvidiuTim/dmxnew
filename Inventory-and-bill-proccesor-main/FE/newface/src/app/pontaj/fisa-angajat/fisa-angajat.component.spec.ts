import { of } from 'rxjs';
import { FisaAngajatComponent } from './fisa-angajat.component';

describe('FisaAngajatComponent documents', () => {
  it('separă angajații activi de cei demiși și deschide doar istoricul pentru demiși', () => {
    const router: any = { navigate: jasmine.createSpy() };
    const component = new FisaAngajatComponent({} as any, router, {} as any, {} as any);
    component.employeeDirectory = [
      { UserId: 1, UserName: 'Activ', employment_status: 'active' },
      { UserId: 2, UserName: 'Demis', employment_status: 'dismissed', dismissed_at: '2026-08-17' },
    ];

    expect(component.activeEmployeeDirectory.map(item => item.UserId)).toEqual([1]);
    expect(component.dismissedEmployeeDirectory.map(item => item.UserId)).toEqual([2]);
    component.openAttendanceHistory(component.dismissedEmployeeDirectory[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/user', 2]);
  });

  it('separă documentele personale de cele de angajare', () => {
    const component = new FisaAngajatComponent({} as any, {} as any, {} as any, {} as any);
    component.documents = [
      { id: 1, document_type: { id: 1, name: 'Pașaport', category: 'personal', category_label: '' } } as any,
      { id: 2, document_type: { id: 2, name: 'Contract', category: 'employment', category_label: '' } } as any,
    ];

    expect(component.documentsFor('personal').map(item => item.id)).toEqual([1]);
    expect(component.documentsFor('employment').map(item => item.id)).toEqual([2]);
  });

  it('trimite data expirării numai pentru documentul configurat cu expirare', () => {
    const api: any = {
      uploadEmployeeDocument: jasmine.createSpy().and.returnValue(of({
        document: { id: 3, document_type: { id: 3, name: 'Pașaport', category: 'personal' } },
      })),
    };
    const component = new FisaAngajatComponent({} as any, {} as any, api, {} as any);
    component.userId = 7;
    component.selectedDocumentFile = new File(['scan'], 'scan.pdf', { type: 'application/pdf' });
    component.documentForm = {
      category: 'personal',
      document_type_id: null,
      document_type_name: 'Pașaport',
      has_expiry: true,
      expiry_date: '2030-01-02',
    };

    component.uploadDocument();

    const payload = api.uploadEmployeeDocument.calls.mostRecent().args[1] as FormData;
    expect(payload.get('document_type_name')).toBe('Pașaport');
    expect(payload.get('has_expiry')).toBe('true');
    expect(payload.get('expiry_date')).toBe('2030-01-02');
  });

  it('bifează implicit câmpurile uzuale pentru export', () => {
    const auth: any = { currentSession: () => ({ role: 'admin', auth_type: 'legacy' }) };
    const component = new FisaAngajatComponent({ snapshot: { paramMap: { get: () => null } } } as any, {} as any, {
      getUsrList: () => of([]),
    } as any, auth);

    component.ngOnInit();
    component.openEmployeeExport();

    expect(component.canExportEmployees).toBeTrue();
    expect(component.isExportFieldSelected('employee_id')).toBeTrue();
    expect(component.isExportFieldSelected('total_salary_ron')).toBeTrue();
    expect(component.isExportFieldSelected('next_ticket_eligibility')).toBeTrue();
    expect(component.isExportFieldSelected('tools')).toBeFalse();
  });
});
