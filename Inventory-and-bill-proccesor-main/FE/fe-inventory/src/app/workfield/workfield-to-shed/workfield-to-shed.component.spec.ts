import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkfieldToShedComponent } from './workfield-to-shed.component';

describe('WorkfieldToShedComponent', () => {
  let component: WorkfieldToShedComponent;
  let fixture: ComponentFixture<WorkfieldToShedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ WorkfieldToShedComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WorkfieldToShedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
