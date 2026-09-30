import { DatePipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { MaterialeComponent } from './materiale.component';

describe('MaterialeComponent', () => {
  let component: MaterialeComponent;
  let fixture: ComponentFixture<MaterialeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MaterialeComponent ],
      imports: [HttpClientTestingModule, FormsModule],
      providers: [DatePipe]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaterialeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
