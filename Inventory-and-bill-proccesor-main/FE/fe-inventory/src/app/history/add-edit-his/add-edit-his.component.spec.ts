import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddEditHisComponent } from './add-edit-his.component';

describe('AddEditHisComponent', () => {
  let component: AddEditHisComponent;
  let fixture: ComponentFixture<AddEditHisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddEditHisComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddEditHisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
