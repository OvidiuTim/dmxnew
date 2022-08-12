import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ColajtipdokaComponent } from './colajtipdoka.component';

describe('ColajtipdokaComponent', () => {
  let component: ColajtipdokaComponent;
  let fixture: ComponentFixture<ColajtipdokaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ColajtipdokaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ColajtipdokaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
