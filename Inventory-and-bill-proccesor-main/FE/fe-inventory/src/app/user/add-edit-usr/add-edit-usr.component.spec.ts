import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddEditUsrComponent } from './add-edit-usr.component';

describe('AddEditUsrComponent', () => {
  let component: AddEditUsrComponent;
  let fixture: ComponentFixture<AddEditUsrComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddEditUsrComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddEditUsrComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
