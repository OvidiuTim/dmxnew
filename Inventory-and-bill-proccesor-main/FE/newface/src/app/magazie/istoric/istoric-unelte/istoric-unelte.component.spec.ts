import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IstoricUnelteComponent } from './istoric-unelte.component';

describe('IstoricUnelteComponent', () => {
  let component: IstoricUnelteComponent;
  let fixture: ComponentFixture<IstoricUnelteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ IstoricUnelteComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IstoricUnelteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
