import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { ClockinandoutComponent } from './clockinandout.component';

describe('ClockinandoutComponent', () => {
  let component: ClockinandoutComponent;
  let fixture: ComponentFixture<ClockinandoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClockinandoutComponent],
      imports: [FormsModule, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClockinandoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
