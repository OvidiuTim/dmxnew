import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditpopiComponent } from './editpopi.component';

describe('EditpopiComponent', () => {
  let component: EditpopiComponent;
  let fixture: ComponentFixture<EditpopiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditpopiComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditpopiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
