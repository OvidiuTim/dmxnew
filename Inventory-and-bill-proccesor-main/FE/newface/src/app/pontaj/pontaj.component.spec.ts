import { of } from 'rxjs';
import { PontajComponent } from './pontaj.component';

describe('PontajComponent', () => {
  it('păstrează profesia angajatului în rândul de pontaj', () => {
    const api: any = {
      getAttendanceDay: () => of({ rows: [{ UserId: 1, UserName: 'Ion Pop', status: 'IN', sessions: [], total_hms: '01:00:00' }] }),
      getUsrList: () => of([{ UserId: 1, UserName: 'Ion Pop', Company: 'RNX', trade: 'Dulgher' }]),
      getAttendanceWorksites: () => of({ worksites: ['The Lake Home Bloc A'] }),
    };
    const component = new PontajComponent(api, {} as any);

    component.loadDay();

    expect(component.rows[0].trade).toBe('Dulgher');
    component.searchTerm = 'dulgher';
    expect(component.filteredRows.length).toBe(1);
  });

  it('păstrează fotografia angajatului și revine la inițială dacă imaginea e invalidă', () => {
    const photo = 'data:image/jpeg;base64,test';
    const api: any = {
      getAttendanceDay: () => of({ rows: [{ UserId: 1, UserName: 'Ion Pop', status: 'IN', sessions: [], total_hms: '01:00:00' }] }),
      getUsrList: () => of([{ UserId: 1, UserName: 'Ion Pop', photo }]),
      getAttendanceWorksites: () => of({ worksites: [] }),
    };
    const component = new PontajComponent(api, {} as any);

    component.loadDay();

    expect(component.rows[0].photo).toBe(photo);
    expect(component.employeeInitial('  ion Pop')).toBe('I');
    component.onPhotoError(1);
    expect(component.failedPhotos.has(1)).toBeTrue();
  });

  it('exclude angajații demiși din Registrul zilei', () => {
    const api: any = {
      getAttendanceDay: () => of({ rows: [{ UserId: 2, UserName: 'Fost Angajat', status: 'OUT', sessions: [], total_hms: '08:00:00' }] }),
      getUsrList: () => of([
        { UserId: 1, UserName: 'Angajat Activ', employment_status: 'active' },
        { UserId: 2, UserName: 'Fost Angajat', employment_status: 'dismissed', dismissed_at: '2026-08-17' },
      ]),
      getAttendanceWorksites: () => of({ worksites: ['The Lake Home Bloc A'] }),
    };
    const component = new PontajComponent(api, {} as any);

    component.loadDay();

    expect(component.rows.map(row => row.UserName)).toEqual(['Angajat Activ']);
  });

  it('exclude angajații marcați Nu se pontează și filtrează după șantier', () => {
    const api: any = {
      getAttendanceDay: () => of({ rows: [
        { UserId: 1, UserName: 'Activ', status: 'IN', sessions: [], total_hms: '01:00:00', day_worksite: 'The Lake Home Bloc A' },
        { UserId: 2, UserName: 'Exceptat', status: 'IN', sessions: [], total_hms: '01:00:00', day_worksite: 'Bloc B' },
      ] }),
      getUsrList: () => of([
        { UserId: 1, UserName: 'Activ' },
        { UserId: 2, UserName: 'Exceptat', attendance_exempt: true },
      ]),
      getAttendanceWorksites: () => of({ worksites: ['The Lake Home Bloc A', 'The Lake Home Bloc B2'] }),
    };
    const component = new PontajComponent(api, {} as any);

    component.loadDay();
    component.selectedWorksite = 'The Lake Home Bloc A';

    expect(component.rows.map(row => row.UserName)).toEqual(['Activ']);
    expect(component.worksiteOptions).toEqual(['The Lake Home Bloc A', 'The Lake Home Bloc B2']);
    expect(component.filteredRows.length).toBe(1);
  });
});
