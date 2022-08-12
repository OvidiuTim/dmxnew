import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnfunctionalToShedComponent } from './unfunctional-to-shed.component';

describe('UnfunctionalToShedComponent', () => {
  let component: UnfunctionalToShedComponent;
  let fixture: ComponentFixture<UnfunctionalToShedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UnfunctionalToShedComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UnfunctionalToShedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
