import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalAddAngajatComponent } from './modal-add-angajat.component';

describe('ModalAddAngajatComponent', () => {
  let component: ModalAddAngajatComponent;
  let fixture: ComponentFixture<ModalAddAngajatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalAddAngajatComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalAddAngajatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
