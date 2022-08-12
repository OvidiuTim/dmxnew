import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShowUsrComponent } from './show-usr.component';

describe('ShowUsrComponent', () => {
  let component: ShowUsrComponent;
  let fixture: ComponentFixture<ShowUsrComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShowUsrComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShowUsrComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
