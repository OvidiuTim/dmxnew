import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MijloacefixeComponent } from './mijloacefixe.component';

describe('MijloacefixeComponent', () => {
  let component: MijloacefixeComponent;
  let fixture: ComponentFixture<MijloacefixeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MijloacefixeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MijloacefixeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
