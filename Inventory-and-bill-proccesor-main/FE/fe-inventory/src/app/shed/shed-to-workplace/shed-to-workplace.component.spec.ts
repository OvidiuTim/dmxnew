import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShedToWorkplaceComponent } from './shed-to-workplace.component';

describe('ShedToWorkplaceComponent', () => {
  let component: ShedToWorkplaceComponent;
  let fixture: ComponentFixture<ShedToWorkplaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShedToWorkplaceComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShedToWorkplaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
