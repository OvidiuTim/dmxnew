import { FormBuilder } from '@angular/forms';

import { EmployeeFormComponent } from './employee-form.component';


describe('EmployeeFormComponent numeric fields', () => {
  it('salvează salariul total și zilele de concediu când inputurile furnizează numere', () => {
    const component = new EmployeeFormComponent(
      new FormBuilder(),
      {} as any,
      {} as any,
      {} as any,
    );
    component.isEditMode = true;
    component.userId = 7;
    component.initialLeaveRemaining = '10.00';
    component.form.patchValue({
      UserName: 'Angajat Test',
      UserSerie: 'TEST-007',
      UserPin: '1234',
    });
    (component.form.controls.total_salary_ron as any).setValue(5500.5);
    (component.form.controls.leave_remaining_days as any).setValue(8);

    const payload = (component as any).buildPayload();

    expect(payload.total_salary_ron).toBe('5500.50');
    expect(payload.leave_remaining_override_days).toBe('8.00');
  });

  it('construiește colaboratorul fără serie introdusă manual', () => {
    const component = new EmployeeFormComponent(
      new FormBuilder(),
      {} as any,
      {} as any,
      {} as any,
    );
    component.onPersonTypeChange('collaborator');
    component.form.patchValue({
      Company: 'Partener Test SRL',
      UserName: 'Responsabil Test',
      phone_number: '0712 345 678',
    });

    const payload = (component as any).buildPayload();

    expect(component.form.valid).toBeTrue();
    expect(payload.Company).toBe('Partener Test SRL');
    expect(payload.UserName).toBe('Responsabil Test');
    expect(payload.phone_number).toBe('0712 345 678');
    expect(payload.UserSerie).toBeUndefined();
  });
});
