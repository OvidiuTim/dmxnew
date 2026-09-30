import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { RapoarteComponent } from './rapoarte.component';

describe('RapoarteComponent', () => {
  let component: RapoarteComponent;
  let fixture: ComponentFixture<RapoarteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RapoarteComponent ],
      imports: [HttpClientTestingModule, FormsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RapoarteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
