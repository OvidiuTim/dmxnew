import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TakeTolFromUserComponent } from './take-tol-from-user.component';

describe('TakeTolFromUserComponent', () => {
  let component: TakeTolFromUserComponent;
  let fixture: ComponentFixture<TakeTolFromUserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TakeTolFromUserComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TakeTolFromUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
