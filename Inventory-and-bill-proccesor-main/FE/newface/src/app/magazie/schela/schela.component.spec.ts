import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SchelaComponent } from './schela.component';

describe('SchelaComponent', () => {
  let component: SchelaComponent;
  let fixture: ComponentFixture<SchelaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SchelaComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SchelaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
