import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddsfmodularaComponent } from './addsfmodulara.component';

describe('AddsfmodularaComponent', () => {
  let component: AddsfmodularaComponent;
  let fixture: ComponentFixture<AddsfmodularaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddsfmodularaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddsfmodularaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
