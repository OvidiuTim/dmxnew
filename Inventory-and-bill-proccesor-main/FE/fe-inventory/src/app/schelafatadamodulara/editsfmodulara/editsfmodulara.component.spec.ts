import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditsfmodularaComponent } from './editsfmodulara.component';

describe('EditsfmodularaComponent', () => {
  let component: EditsfmodularaComponent;
  let fixture: ComponentFixture<EditsfmodularaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditsfmodularaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditsfmodularaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
