import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchelafatadaComponent } from './schelafatada.component';

describe('SchelafatadaComponent', () => {
  let component: SchelafatadaComponent;
  let fixture: ComponentFixture<SchelafatadaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchelafatadaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SchelafatadaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
