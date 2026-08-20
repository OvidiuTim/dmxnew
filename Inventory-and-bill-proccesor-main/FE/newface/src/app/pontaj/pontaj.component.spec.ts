import { of } from 'rxjs';
import { PontajComponent } from './pontaj.component';

describe('PontajComponent', () => {
  it('păstrează profesia angajatului în rândul de pontaj', () => {
    const api: any = {
      getAttendanceDay: () => of({ rows: [{ UserId: 1, UserName: 'Ion Pop', status: 'IN', sessions: [], total_hms: '01:00:00' }] }),
      getUsrList: () => of([{ UserId: 1, UserName: 'Ion Pop', Company: 'RNX', trade: 'Dulgher' }]),
    };
    const component = new PontajComponent(api, {} as any);

    component.loadDay();

    expect(component.rows[0].trade).toBe('Dulgher');
    component.searchTerm = 'dulgher';
    expect(component.filteredRows.length).toBe(1);
  });

  it('exclude angajații demiși din Registrul zilei', () => {
    const api: any = {
      getAttendanceDay: () => of({ rows: [{ UserId: 2, UserName: 'Fost Angajat', status: 'OUT', sessions: [], total_hms: '08:00:00' }] }),
      getUsrList: () => of([
        { UserId: 1, UserName: 'Angajat Activ', employment_status: 'active' },
        { UserId: 2, UserName: 'Fost Angajat', employment_status: 'dismissed', dismissed_at: '2026-08-17' },
      ]),
    };
    const component = new PontajComponent(api, {} as any);

    component.loadDay();

    expect(component.rows.map(row => row.UserName)).toEqual(['Angajat Activ']);
  });

  it('exclude angajații marcați Nu se pontează și filtrează după șantier', () => {
    const api: any = {
      getAttendanceDay: () => of({ rows: [
        { UserId: 1, UserName: 'Activ', status: 'IN', sessions: [], total_hms: '01:00:00', day_worksite: 'Bloc A' },
        { UserId: 2, UserName: 'Exceptat', status: 'IN', sessions: [], total_hms: '01:00:00', day_worksite: 'Bloc B' },
      ] }),
      getUsrList: () => of([
        { UserId: 1, UserName: 'Activ' },
        { UserId: 2, UserName: 'Exceptat', attendance_exempt: true },
      ]),
    };
    const component = new PontajComponent(api, {} as any);

    component.loadDay();
    component.selectedWorksite = 'Bloc A';

    expect(component.rows.map(row => row.UserName)).toEqual(['Activ']);
    expect(component.worksiteOptions).toEqual(['Bloc A']);
    expect(component.filteredRows.length).toBe(1);
  });
});
