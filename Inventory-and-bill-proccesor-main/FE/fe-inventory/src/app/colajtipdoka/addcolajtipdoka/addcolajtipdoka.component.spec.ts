import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddcolajtipdokaComponent } from './addcolajtipdoka.component';

describe('AddcolajtipdokaComponent', () => {
  let component: AddcolajtipdokaComponent;
  let fixture: ComponentFixture<AddcolajtipdokaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AddcolajtipdokaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddcolajtipdokaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
