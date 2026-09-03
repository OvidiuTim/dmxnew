import { of } from 'rxjs';
import { LeaveRequestsComponent } from './leave-requests.component';

describe('LeaveRequestsComponent India ticket report', () => {
  it('afișează rezultatele returnate de backend pentru perioada selectată', () => {
    const api: any = {
      getIndiaTicketEligibilityReport: jasmine.createSpy().and.returnValue(of({
        employees: [{
          employee_id: 1,
          name: 'Angajat Eligibil',
          series: 'IND-1',
          company: 'DMX',
          trade: 'Montator',
          hire_date: '2025-09-20',
          seniority_months: 11,
          seniority: '11 luni',
          already_used: false,
          last_home_trip_date: null,
          next_eligibility_date: '2026-09-20',
          situation: 'Devine eligibil la data de 20.09.2026',
        }],
      })),
    };
    const component = new LeaveRequestsComponent(api);
    component.indiaReportForm = { start_date: '2026-09-01', end_date: '2026-10-31' };

    component.searchIndiaTicketReport();

    expect(api.getIndiaTicketEligibilityReport).toHaveBeenCalledWith('2026-09-01', '2026-10-31');
    expect(component.indiaReportRows.map(item => item.series)).toEqual(['IND-1']);
    expect(component.indiaReportSearched).toBeTrue();
  });

  it('respinge o perioadă inversată fără apel backend', () => {
    const api: any = { getIndiaTicketEligibilityReport: jasmine.createSpy() };
    const component = new LeaveRequestsComponent(api);
    component.indiaReportForm = { start_date: '2026-10-31', end_date: '2026-09-01' };

    component.searchIndiaTicketReport();

    expect(api.getIndiaTicketEligibilityReport).not.toHaveBeenCalled();
    expect(component.indiaReportError).toContain('nu poate fi înainte');
  });
});
