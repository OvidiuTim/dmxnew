import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowShedComponent } from './show-shed.component';

describe('ShowShedComponent', () => {
  let component: ShowShedComponent;
  let fixture: ComponentFixture<ShowShedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShowShedComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShowShedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
