import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IstoricComponent } from './istoric.component';

describe('IstoricComponent', () => {
  let component: IstoricComponent;
  let fixture: ComponentFixture<IstoricComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ IstoricComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IstoricComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
