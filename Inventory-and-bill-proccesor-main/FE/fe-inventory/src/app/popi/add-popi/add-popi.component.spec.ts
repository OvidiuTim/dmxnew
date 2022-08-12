import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddPopiComponent } from './add-popi.component';

describe('AddPopiComponent', () => {
  let component: AddPopiComponent;
  let fixture: ComponentFixture<AddPopiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddPopiComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddPopiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
