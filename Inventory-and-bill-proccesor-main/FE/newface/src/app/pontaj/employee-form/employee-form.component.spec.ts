import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';

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
    (component.form.controls.salary_advance_ron as any).setValue(1000);
    (component.form.controls.salary_remainder_ron as any).setValue(4500.5);
    (component.form.controls.meal_vouchers_ron as any).setValue(650);
    (component.form.controls.leave_remaining_days as any).setValue(8);

    const payload = (component as any).buildPayload();

    expect(payload.total_salary_ron).toBe('5500.50');
    expect(payload.salary_advance_ron).toBe('1000.00');
    expect(payload.salary_remainder_ron).toBe('4500.50');
    expect(payload.meal_vouchers_ron).toBe('650.00');
    expect(payload.leave_remaining_override_days).toBe('8.00');
  });

  it('încarcă automat valorile salariale la editarea angajatului', () => {
    const api: any = {
      getUser: jasmine.createSpy().and.returnValue(of({
        UserId: 7,
        UserName: 'Angajat Test',
        UserSerie: 'TEST-007',
        hourly_rate: '23.00',
        total_salary_ron: '5500.00',
        salary_advance_ron: '1000.00',
        salary_remainder_ron: '4500.00',
        meal_vouchers_ron: '650.00',
        leave_balance: { remaining_days: '10.00' },
      })),
    };
    const component = new EmployeeFormComponent(
      new FormBuilder(),
      {} as any,
      {} as any,
      api,
    );

    (component as any).loadUser(7);

    expect(component.form.value.salary_advance_ron).toBe('1000.00');
    expect(component.form.value.salary_remainder_ron).toBe('4500.00');
    expect(component.form.value.meal_vouchers_ron).toBe('650.00');
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
