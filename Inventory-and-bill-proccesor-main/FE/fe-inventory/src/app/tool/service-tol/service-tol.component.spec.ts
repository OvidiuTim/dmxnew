import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceTolComponent } from './service-tol.component';

describe('ServiceTolComponent', () => {
  let component: ServiceTolComponent;
  let fixture: ComponentFixture<ServiceTolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ServiceTolComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ServiceTolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
