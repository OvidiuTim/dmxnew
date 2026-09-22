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

  it('uses the principal attendance worksite coordinates in clock-in and team dashboard mode', () => {
    const byName = new Map(component.worksites.map(worksite => [worksite.name, worksite]));

    expect(component.worksites.length).toBe(16);
    expect(component.worksites.every(worksite => worksite.radiusMeters === 90)).toBeTrue();
    expect(byName.get('The Lake Home Bloc A')?.center).toEqual({
      lat: 45.81034964338528,
      lng: 24.130413480467038,
    });
    expect(byName.get('Birou ingineri & TESA')?.center).toEqual({
      lat: 45.809820427020156,
      lng: 24.13019018453687,
    });
    expect(byName.get('Magazie si aprovizionare')?.center).toEqual({
      lat: 45.81009008953653,
      lng: 24.130724515361457,
    });
    expect(byName.get('Cisnadie')?.center).toEqual({
      lat: 45.71648035800439,
      lng: 24.162636701234426,
    });
    expect(byName.get('The River chalet')?.center).toEqual({
      lat: 45.76837384893173,
      lng: 23.916721618503065,
    });
  });

  it('uses the selfie immediately after it is taken and keeps only the retake action', () => {
    const video: any = { videoWidth: 640, videoHeight: 480, srcObject: {} };
    component.cameraPreview = { nativeElement: video } as any;
    const context = { drawImage: jasmine.createSpy() };
    const canvas: any = {
      width: 0,
      height: 0,
      getContext: () => context,
      toDataURL: () => 'data:image/webp;base64,VEVTVA==',
    };
    const nativeCreateElement = document.createElement.bind(document);
    spyOn(document, 'createElement').and.callFake((tagName: string) =>
      tagName.toLowerCase() === 'canvas' ? canvas : nativeCreateElement(tagName));

    component.captureSelfie();

    expect(component.capturedSelfie).toBe('data:image/webp;base64,VEVTVA==');
    expect(component.confirmedSelfie).toBe(component.capturedSelfie);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fotografie făcută');
    expect(fixture.nativeElement.textContent).toContain('Refă fotografia');
    expect(fixture.nativeElement.textContent).not.toContain('Folosește fotografia');
  });

  it('accepts a captured GPS position outside the perimeter only for a portal driver', () => {
    component.portalMode = true;
    component.portalDriver = true;
    component.selectedWorksite = component.worksites[0];
    component.currentPosition = { lat: 46, lng: 25, accuracy: 8 };
    component.locationState = 'outside';
    component.locationCapturedAt = new Date();
    component.dataProcessingConsent = true;
    component.confirmedSelfie = 'data:image/webp;base64,MTIz';

    expect(component.locationAccepted).toBeTrue();
    expect(component.canSubmit).toBeTrue();

    component.portalDriver = false;
    expect(component.locationAccepted).toBeFalse();
    expect(component.canSubmit).toBeFalse();
  });
});
