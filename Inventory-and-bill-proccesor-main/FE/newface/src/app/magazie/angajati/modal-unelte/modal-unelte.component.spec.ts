import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalUnelteComponent } from './modal-unelte.component';

describe('ModalUnelteComponent', () => {
  let component: ModalUnelteComponent;
  let fixture: ComponentFixture<ModalUnelteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModalUnelteComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalUnelteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
