import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddMijloaceComponent } from './add-mijloace.component';

describe('AddMijloaceComponent', () => {
  let component: AddMijloaceComponent;
  let fixture: ComponentFixture<AddMijloaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddMijloaceComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddMijloaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
