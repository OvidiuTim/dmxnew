import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowHisComponent } from './show-his.component';

describe('ShowHisComponent', () => {
  let component: ShowHisComponent;
  let fixture: ComponentFixture<ShowHisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShowHisComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShowHisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
