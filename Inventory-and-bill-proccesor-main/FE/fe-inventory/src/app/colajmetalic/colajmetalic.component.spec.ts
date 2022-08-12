import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ColajmetalicComponent } from './colajmetalic.component';

describe('ColajmetalicComponent', () => {
  let component: ColajmetalicComponent;
  let fixture: ComponentFixture<ColajmetalicComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ColajmetalicComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ColajmetalicComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
