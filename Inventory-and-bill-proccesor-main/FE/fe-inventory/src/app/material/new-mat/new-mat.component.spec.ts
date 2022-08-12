import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewMatComponent } from './new-mat.component';

describe('NewMatComponent', () => {
  let component: NewMatComponent;
  let fixture: ComponentFixture<NewMatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NewMatComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NewMatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
