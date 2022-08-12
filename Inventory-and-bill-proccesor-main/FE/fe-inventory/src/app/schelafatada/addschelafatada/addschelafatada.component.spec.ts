import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddschelafatadaComponent } from './addschelafatada.component';

describe('AddschelafatadaComponent', () => {
  let component: AddschelafatadaComponent;
  let fixture: ComponentFixture<AddschelafatadaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddschelafatadaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddschelafatadaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
