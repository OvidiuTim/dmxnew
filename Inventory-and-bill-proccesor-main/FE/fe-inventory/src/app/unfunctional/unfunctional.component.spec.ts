import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnfunctionalComponent } from './unfunctional.component';

describe('UnfunctionalComponent', () => {
  let component: UnfunctionalComponent;
  let fixture: ComponentFixture<UnfunctionalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UnfunctionalComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UnfunctionalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
