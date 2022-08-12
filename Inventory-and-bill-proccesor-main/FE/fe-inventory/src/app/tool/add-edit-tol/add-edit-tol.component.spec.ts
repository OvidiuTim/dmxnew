import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddEditTolComponent } from './add-edit-tol.component';

describe('AddEditTolComponent', () => {
  let component: AddEditTolComponent;
  let fixture: ComponentFixture<AddEditTolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddEditTolComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddEditTolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
