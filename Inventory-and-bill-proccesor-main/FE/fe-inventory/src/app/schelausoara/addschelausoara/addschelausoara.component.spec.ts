import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddschelausoaraComponent } from './addschelausoara.component';

describe('AddschelausoaraComponent', () => {
  let component: AddschelausoaraComponent;
  let fixture: ComponentFixture<AddschelausoaraComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddschelausoaraComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddschelausoaraComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
