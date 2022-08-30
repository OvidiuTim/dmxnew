import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditmijloaceComponent } from './editmijloace.component';

describe('EditmijloaceComponent', () => {
  let component: EditmijloaceComponent;
  let fixture: ComponentFixture<EditmijloaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditmijloaceComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditmijloaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
