import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnelteComponent } from './unelte.component';

describe('UnelteComponent', () => {
  let component: UnelteComponent;
  let fixture: ComponentFixture<UnelteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UnelteComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnelteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
