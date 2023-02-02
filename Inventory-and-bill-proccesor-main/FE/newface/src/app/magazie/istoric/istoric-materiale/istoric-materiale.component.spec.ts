import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IstoricMaterialeComponent } from './istoric-materiale.component';

describe('IstoricMaterialeComponent', () => {
  let component: IstoricMaterialeComponent;
  let fixture: ComponentFixture<IstoricMaterialeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ IstoricMaterialeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IstoricMaterialeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
