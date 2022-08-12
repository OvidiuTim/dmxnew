import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditschelafatadaComponent } from './editschelafatada.component';

describe('EditschelafatadaComponent', () => {
  let component: EditschelafatadaComponent;
  let fixture: ComponentFixture<EditschelafatadaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditschelafatadaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditschelafatadaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
