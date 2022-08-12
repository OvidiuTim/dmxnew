import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CombustibilComponent } from './combustibil.component';

describe('CombustibilComponent', () => {
  let component: CombustibilComponent;
  let fixture: ComponentFixture<CombustibilComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CombustibilComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CombustibilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
