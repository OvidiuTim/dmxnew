import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShedToUnfunctionalComponent } from './shed-to-unfunctional.component';

describe('ShedToUnfunctionalComponent', () => {
  let component: ShedToUnfunctionalComponent;
  let fixture: ComponentFixture<ShedToUnfunctionalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShedToUnfunctionalComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShedToUnfunctionalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
