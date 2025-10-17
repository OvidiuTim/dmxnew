import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PontajComponent } from './pontaj.component';

describe('PontajComponent', () => {
  let component: PontajComponent;
  let fixture: ComponentFixture<PontajComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PontajComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PontajComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
