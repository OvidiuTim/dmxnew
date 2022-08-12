import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowMatComponent } from './show-mat.component';

describe('ShowMatComponent', () => {
  let component: ShowMatComponent;
  let fixture: ComponentFixture<ShowMatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShowMatComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShowMatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
