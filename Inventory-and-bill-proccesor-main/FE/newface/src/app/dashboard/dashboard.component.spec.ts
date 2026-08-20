import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { SharedService } from '../shared.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let session: any;

  beforeEach(async () => {
    session = { role: 'admin', auth_type: 'legacy', modules: [] };
    const service = {
      getAttendanceDay: () => of({ rows: [] }),
      getUsrList: () => of([]),
      getAttendanceWorksiteReport: () => of({ summary: { worksites_count: 0 }, rows: [] }),
      getAttendanceDayCostReport: () => of({ summary: { total_cost: 0 } }),
      getHisList: () => of([]),
    };
    const auth = { currentSession: () => session };

    await TestBed.configureTestingModule({
      imports: [CommonModule, RouterTestingModule],
      declarations: [DashboardComponent],
      providers: [
        { provide: SharedService, useValue: service },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  });

  it('afișează legăturile Unelte și Administrare după loginul cu parola generală', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('.admin-shortcuts a')) as HTMLAnchorElement[];

    expect(links.map(link => link.querySelector('span:last-child')?.textContent?.trim()))
      .toEqual(['Aplicație unelte', 'Pagina administrare']);
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/unelte', '/admin-app-page']);
  });

  it('ascunde legăturile administrative pentru un cont individual', () => {
    session = { role: 'app_user', auth_type: 'app_user', modules: ['attendance', 'tools'] };
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.admin-shortcuts')).toBeNull();
  });

  it('separă absenții fără pontaj de angajații aflați în concediu', () => {
    const component = fixture.componentInstance;
    component.totalEmployees = 5;
    component.clockedToday = 2;
    component.attendanceRows = [{ status: 'IN' }, { status: 'OUT' }, { status: 'LEAVE' }];

    expect(component.absentToday).toBe(2);
    expect(component.leaveToday).toBe(1);
  });
});
