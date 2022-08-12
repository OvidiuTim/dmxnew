import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RemoveMatComponent } from './remove-mat.component';

describe('RemoveMatComponent', () => {
  let component: RemoveMatComponent;
  let fixture: ComponentFixture<RemoveMatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RemoveMatComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RemoveMatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
