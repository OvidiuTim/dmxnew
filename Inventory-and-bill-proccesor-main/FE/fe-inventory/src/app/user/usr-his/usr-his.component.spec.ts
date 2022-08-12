import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsrHisComponent } from './usr-his.component';

describe('UsrHisComponent', () => {
  let component: UsrHisComponent;
  let fixture: ComponentFixture<UsrHisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UsrHisComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UsrHisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
