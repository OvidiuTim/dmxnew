import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditcolajtipdokaComponent } from './editcolajtipdoka.component';

describe('EditcolajtipdokaComponent', () => {
  let component: EditcolajtipdokaComponent;
  let fixture: ComponentFixture<EditcolajtipdokaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditcolajtipdokaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditcolajtipdokaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
