import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IstoricSchelaComponent } from './istoric-schela.component';

describe('IstoricSchelaComponent', () => {
  let component: IstoricSchelaComponent;
  let fixture: ComponentFixture<IstoricSchelaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ IstoricSchelaComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IstoricSchelaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
