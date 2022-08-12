import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditColajMetalicComponent } from './edit-colaj-metalic.component';

describe('EditColajMetalicComponent', () => {
  let component: EditColajMetalicComponent;
  let fixture: ComponentFixture<EditColajMetalicComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditColajMetalicComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditColajMetalicComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
