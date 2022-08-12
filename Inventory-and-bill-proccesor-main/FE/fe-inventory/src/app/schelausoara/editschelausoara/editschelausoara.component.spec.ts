import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditschelausoaraComponent } from './editschelausoara.component';

describe('EditschelausoaraComponent', () => {
  let component: EditschelausoaraComponent;
  let fixture: ComponentFixture<EditschelausoaraComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditschelausoaraComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditschelausoaraComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
