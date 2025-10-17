import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserpontatComponent } from './userpontat.component';

describe('UserpontatComponent', () => {
  let component: UserpontatComponent;
  let fixture: ComponentFixture<UserpontatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UserpontatComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserpontatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
