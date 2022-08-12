import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowTolComponent } from './show-tol.component';

describe('ShowTolComponent', () => {
  let component: ShowTolComponent;
  let fixture: ComponentFixture<ShowTolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShowTolComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShowTolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
