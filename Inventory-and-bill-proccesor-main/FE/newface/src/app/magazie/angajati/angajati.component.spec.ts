import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { AngajatiComponent } from './angajati.component';

describe('AngajatiComponent', () => {
  let component: AngajatiComponent;
  let fixture: ComponentFixture<AngajatiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AngajatiComponent ],
      imports: [HttpClientTestingModule, FormsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AngajatiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
