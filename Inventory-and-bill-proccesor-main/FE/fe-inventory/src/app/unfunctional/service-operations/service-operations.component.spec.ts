import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceOperationsComponent } from './service-operations.component';

describe('ServiceOperationsComponent', () => {
  let component: ServiceOperationsComponent;
  let fixture: ComponentFixture<ServiceOperationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ServiceOperationsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ServiceOperationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
