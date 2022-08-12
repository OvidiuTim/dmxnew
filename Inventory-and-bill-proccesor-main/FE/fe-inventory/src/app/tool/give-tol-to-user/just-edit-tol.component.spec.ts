import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JustEditTolComponent } from './just-edit-tol.component';

describe('JustEditTolComponent', () => {
  let component: JustEditTolComponent;
  let fixture: ComponentFixture<JustEditTolComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ JustEditTolComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JustEditTolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
