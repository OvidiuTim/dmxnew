import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { UserpontatComponent } from './userpontat.component';

describe('UserpontatComponent', () => {
  let component: UserpontatComponent;
  let fixture: ComponentFixture<UserpontatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UserpontatComponent ],
      imports: [HttpClientTestingModule, RouterTestingModule]
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
