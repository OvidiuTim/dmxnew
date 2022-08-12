import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddcolajmetalicComponent } from './addcolajmetalic.component';

describe('AddcolajmetalicComponent', () => {
  let component: AddcolajmetalicComponent;
  let fixture: ComponentFixture<AddcolajmetalicComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddcolajmetalicComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddcolajmetalicComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
