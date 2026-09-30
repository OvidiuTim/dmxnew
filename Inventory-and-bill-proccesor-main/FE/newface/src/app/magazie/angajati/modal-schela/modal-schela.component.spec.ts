import { DatePipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { ModalSchelaComponent } from './modal-schela.component';
import { SharedService } from '../../../shared.service';

describe('ModalSchelaComponent', () => {
  let component: ModalSchelaComponent;
  let fixture: ComponentFixture<ModalSchelaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalSchelaComponent ],
      imports: [HttpClientTestingModule, FormsModule],
      providers: [DatePipe]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalSchelaComponent);
    component = fixture.componentInstance;
    TestBed.inject(SharedService).selectedUser = { UserName: 'Angajat Test' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
