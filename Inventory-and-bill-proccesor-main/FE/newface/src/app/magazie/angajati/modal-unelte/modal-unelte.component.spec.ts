import { DatePipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { ModalUnelteComponent } from './modal-unelte.component';
import { SharedService } from '../../../shared.service';

describe('ModalUnelteComponent', () => {
  let component: ModalUnelteComponent;
  let fixture: ComponentFixture<ModalUnelteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalUnelteComponent ],
      imports: [HttpClientTestingModule, FormsModule],
      providers: [DatePipe]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalUnelteComponent);
    component = fixture.componentInstance;
    TestBed.inject(SharedService).selectedUser = { UserName: 'Angajat Test' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
