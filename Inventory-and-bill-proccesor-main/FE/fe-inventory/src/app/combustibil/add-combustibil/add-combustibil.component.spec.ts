import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddCombustibilComponent } from './add-combustibil.component';

describe('AddCombustibilComponent', () => {
  let component: AddCombustibilComponent;
  let fixture: ComponentFixture<AddCombustibilComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddCombustibilComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddCombustibilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
