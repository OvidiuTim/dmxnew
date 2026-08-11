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
});
