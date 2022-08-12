import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchelafatadamodularaComponent } from './schelafatadamodulara.component';

describe('SchelafatadamodularaComponent', () => {
  let component: SchelafatadamodularaComponent;
  let fixture: ComponentFixture<SchelafatadamodularaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchelafatadamodularaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SchelafatadamodularaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
