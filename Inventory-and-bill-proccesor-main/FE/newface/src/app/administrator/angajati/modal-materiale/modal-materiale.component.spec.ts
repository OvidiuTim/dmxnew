import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalMaterialeComponent } from './modal-materiale.component';

describe('ModalMaterialeComponent', () => {
  let component: ModalMaterialeComponent;
  let fixture: ComponentFixture<ModalMaterialeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalMaterialeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalMaterialeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
