import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HSchelaComponent } from './h-schela.component';

describe('HSchelaComponent', () => {
  let component: HSchelaComponent;
  let fixture: ComponentFixture<HSchelaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HSchelaComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HSchelaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
