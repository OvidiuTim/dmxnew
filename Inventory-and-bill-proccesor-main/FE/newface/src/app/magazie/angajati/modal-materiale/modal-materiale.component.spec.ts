import { DatePipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { ModalMaterialeComponent } from './modal-materiale.component';
import { SharedService } from '../../../shared.service';

describe('ModalMaterialeComponent', () => {
  let component: ModalMaterialeComponent;
  let fixture: ComponentFixture<ModalMaterialeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalMaterialeComponent ],
      imports: [HttpClientTestingModule],
      providers: [DatePipe]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalMaterialeComponent);
    component = fixture.componentInstance;
    TestBed.inject(SharedService).selectedUser = { UserName: 'Angajat Test' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
