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

  it('allows submission in chef mode only for PIN 1165 inside the fixed area', () => {
    component.chefMode = true;
    component.selectedWorksite = component.chefWorksite;
    component.currentPosition = { ...component.chefWorksite.center, accuracy: 8 };
    component.locationState = 'inside';
    component.locationCapturedAt = new Date();
    component.dataProcessingConsent = true;
    component.confirmedSelfie = 'data:image/webp;base64,MTIz';

    component.pin = '2211';
    expect(component.canSubmit).toBeFalse();

    component.pin = '1165';
    expect(component.canSubmit).toBeTrue();
  });
});
