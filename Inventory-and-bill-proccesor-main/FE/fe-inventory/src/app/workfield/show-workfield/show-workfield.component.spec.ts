import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowWorkfieldComponent } from './show-workfield.component';

describe('ShowWorkfieldComponent', () => {
  let component: ShowWorkfieldComponent;
  let fixture: ComponentFixture<ShowWorkfieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShowWorkfieldComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShowWorkfieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
