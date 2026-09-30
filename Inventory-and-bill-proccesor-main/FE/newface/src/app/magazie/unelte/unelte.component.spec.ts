import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { UnelteComponent } from './unelte.component';

describe('UnelteComponent', () => {
  let component: UnelteComponent;
  let fixture: ComponentFixture<UnelteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UnelteComponent ],
      imports: [HttpClientTestingModule],
      schemas: [NO_ERRORS_SCHEMA]
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
