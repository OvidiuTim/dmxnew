import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalSchelaComponent } from './modal-schela.component';

describe('ModalSchelaComponent', () => {
  let component: ModalSchelaComponent;
  let fixture: ComponentFixture<ModalSchelaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalSchelaComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalSchelaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
