import { readEmployeeLanguage } from '../i18n/employee-language';
import { attendanceCopy } from '../i18n/attendance-copy';
import { employeeCopy } from '../i18n/employee-copy';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { SharedService } from '../shared.service';

type FeedbackKind = 'enter' | 'exit' | 'error';
type AttendanceState = 'ENTER' | 'EXIT';
type LocationState = 'idle' | 'loading' | 'ready' | 'expired' | 'denied' | 'unsupported' | 'error';

interface FeedbackState {
  kind: FeedbackKind;
  title: string;
  message: string;
  stamp: string;
}

interface CurrentPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

@Component({
  selector: 'app-clockinandoutdriver',
  templateUrl: './clockinandoutdriver.component.html',
  styleUrls: ['./clockinandoutdriver.component.css']
})
export class ClockinandoutdriverComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('cameraPreview') cameraPreview?: ElementRef<HTMLVideoElement>;

  readonly language = readEmployeeLanguage();
  readonly t = attendanceCopy[this.language];
  readonly ui = employeeCopy[this.language];
  readonly locale = { ro: 'ro-RO', en: 'en-GB', pa: 'pa-IN', hi: 'hi-IN', ne: 'ne-NP' }[this.language];

  pin = '';
  submitting = false;
  dataProcessingConsent = false;
  cameraOpen = false;
  capturedSelfie: string | null = null;
  confirmedSelfie: string | null = null;
  cameraError = '';
  currentTime = new Date();
  feedback: FeedbackState | null = null;
  currentPosition: CurrentPosition | null = null;
  locationState: LocationState = 'idle';
  locationCapturedAt: Date | null = null;
  readonly locationValidityMs = 10 * 60 * 1000;

  private map: L.Map | null = null;
  private userMarker: L.CircleMarker | null = null;
  private accuracyCircle: L.Circle | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private cameraStream: MediaStream | null = null;

  constructor(private api: SharedService) {}

  ngOnInit(): void {
    this.clockTimer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.map?.remove();
    this.stopCamera();
  }

  get formattedDate(): string {
    return new Intl.DateTimeFormat(this.locale, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(this.currentTime);
  }

  get formattedTime(): string {
    return new Intl.DateTimeFormat(this.locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(this.currentTime);
  }

  get isLocationFresh(): boolean {
    if (!this.locationCapturedAt) {
      return false;
    }

    return (this.currentTime.getTime() - this.locationCapturedAt.getTime()) <= this.locationValidityMs;
  }

  get effectiveLocationState(): LocationState {
    if (this.locationState === 'ready' && !this.isLocationFresh) {
      return 'expired';
    }

    if (this.currentPosition && this.locationCapturedAt && !this.isLocationFresh) {
      return 'expired';
    }

    return this.locationState;
  }

  get canSubmit(): boolean {
    return !!this.pin.trim()
      && !!this.currentPosition
      && this.effectiveLocationState === 'ready'
      && this.dataProcessingConsent
      && !!this.confirmedSelfie
      && !this.submitting;
  }

  get locationBadge(): string {
    return {
      idle: this.ui.locationMissing,
      loading: this.t.gpsLoadingBadge,
      ready: this.ui.locationReady,
      expired: this.ui.locationExpired,
      denied: this.t.gpsDeniedBadge,
      unsupported: this.t.gpsUnsupportedBadge,
      error: this.t.gpsErrorBadge
    }[this.effectiveLocationState];
  }

  get locationTitle(): string {
    return {
      idle: this.ui.locationMissing,
      loading: this.t.gpsLoadingTitle,
      ready: this.ui.locationReady,
      expired: this.ui.locationExpired,
      denied: this.t.gpsDeniedTitle,
      unsupported: this.t.gpsUnsupportedTitle,
      error: this.t.gpsErrorTitle
    }[this.effectiveLocationState];
  }

  get locationDetail(): string {
    return {
      idle: this.ui.refreshLocation,
      loading: this.ui.driverHint,
      ready: this.ui.driverHint,
      expired: this.ui.locationExpired,
      denied: this.t.gpsDeniedDetail,
      unsupported: this.t.gpsUnsupportedDetail,
      error: this.t.gpsErrorDetail
    }[this.effectiveLocationState];
  }

  get locationFreshForLabel(): string | null {
    if (!this.locationCapturedAt || !this.isLocationFresh) {
      return null;
    }

    const remainingMs = Math.max(0, this.locationValidityMs - (this.currentTime.getTime() - this.locationCapturedAt.getTime()));
    return `${this.ui.locationValidity} ${this.formatRemainingTime(remainingMs)}.`;
  }

  get locationReadyHint(): string {
    if (!this.currentPosition) {
      return this.ui.locationMissing;
    }

    if (this.effectiveLocationState === 'expired') {
      return this.ui.locationExpired;
    }

    return `${this.ui.myPosition}: ${this.formatCoordinates(this.currentPosition.lat, this.currentPosition.lng)}. ${this.t.accuracyLabel(this.currentPosition.accuracy)}`;
  }

  get gateMessage(): string {
    if (!this.currentPosition) {
      return this.ui.locationMissing;
    }

    if (this.effectiveLocationState === 'expired') {
      return this.ui.locationExpired;
    }

    if (!this.dataProcessingConsent) {
      return this.t.consentRequired;
    }

    if (!this.confirmedSelfie) {
      return this.t.selfieRequired;
    }

    if (this.effectiveLocationState === 'ready') {
      return this.ui.locationReady;
    }

    return this.ui.locationMissing;
  }

  updatePin(value: string): void {
    const nextPin = value.replace(/\D/g, '').slice(0, 12);
    if (nextPin !== this.pin && (this.cameraOpen || this.capturedSelfie || this.confirmedSelfie)) this.resetSelfie();
    this.pin = nextPin;
  }

  clearPin(): void {
    this.pin = '';
    this.resetSelfie();
  }

  refreshLocation(): void {
    this.requestFreshLocation();
  }

  submitPin(): void {
    if (!this.currentPosition) {
      this.showError(this.ui.driverHint);
      return;
    }

    if (this.effectiveLocationState === 'expired') {
      this.showError(this.ui.locationExpired);
      return;
    }

    if (this.effectiveLocationState !== 'ready') {
      this.showError(this.ui.driverHint);
      return;
    }

    if (!this.dataProcessingConsent) {
      this.showError(this.t.consentRequired);
      return;
    }

    if (!this.confirmedSelfie) {
      this.showError(this.t.selfieRequired);
      return;
    }

    const cleanPin = this.pin.trim();
    this.submitting = true;

    this.submitAttendanceRequest(cleanPin, this.confirmedSelfie).subscribe({
      next: (response) => {
        this.submitting = false;
        if (response?.debounced) return;
        if (!response?.user?.name || !response?.state) {
          this.showError(this.t.invalidPin);
          return;
        }
        this.showAttendanceFeedback(response.state, response.user.name);
        this.clearPin();
        this.dataProcessingConsent = false;
      },
      error: (error) => {
        this.submitting = false;
        this.showError(this.resolveAttendanceError(error));
      }
    });
  }

  formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  private showAttendanceFeedback(state: AttendanceState, userName: string): void {
    const locationText = this.currentPosition
      ? ` ${this.ui.myPosition}: ${this.formatCoordinates(this.currentPosition.lat, this.currentPosition.lng)}.`
      : '';

    this.feedback = state === 'ENTER'
      ? {
          kind: 'enter',
          title: this.t.enterTitle,
          message: `${this.t.successEnter(userName)}${locationText}`,
          stamp: this.t.processedAt(this.formattedTime)
        }
      : {
          kind: 'exit',
          title: this.t.exitTitle,
          message: `${this.t.successExit(userName)}${locationText}`,
          stamp: this.t.processedAt(this.formattedTime)
        };

    this.scheduleFeedbackReset();
  }

  private showError(message: string): void {
    this.feedback = {
      kind: 'error',
      title: this.t.unfinishedTitle,
      message,
      stamp: this.t.processedAt(this.formattedTime)
    };

    this.scheduleFeedbackReset();
  }

  private resolveAttendanceError(error: any): string {
    const code = typeof error?.error?.error_code === 'string' ? error.error.error_code : '';
    if (code === 'GPS_REQUIRED_FOR_DRIVER') {
      return this.ui.driverHint;
    }

    if (code === 'GPS_CAPTURE_EXPIRED') {
      return this.ui.locationExpired;
    }

    return this.language === 'ro' && typeof error?.error?.error === 'string'
      ? error.error.error
      : this.t.genericError;
  }

  private submitAttendanceRequest(pin: string, attendancePhoto: string) {
    return this.api.manualAttendanceByPin(pin, {
      mode: 'driver',
      gps: {
        lat: this.currentPosition!.lat,
        lng: this.currentPosition!.lng,
        accuracy: this.currentPosition!.accuracy,
        capturedAt: this.locationCapturedAt?.toISOString()
      },
      dataProcessingConsent: this.dataProcessingConsent,
      attendancePhoto,
    });
  }

  async openCamera(): Promise<void> {
    this.cameraError = '';
    this.capturedSelfie = null;
    this.confirmedSelfie = null;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.cameraError = this.t.cameraUnavailable;
      return;
    }

    const video = this.cameraPreview?.nativeElement;
    if (!video) {
      this.cameraError = this.t.cameraNotReady;
      return;
    }

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 640 } }
      });
      this.cameraOpen = true;
      video.srcObject = this.cameraStream;
      await video.play();
    } catch (error: any) {
      this.stopCamera();
      this.cameraError = error?.name === 'NotAllowedError'
        ? this.t.cameraDenied
        : this.t.cameraMissing;
    }
  }

  captureSelfie(): void {
    const video = this.cameraPreview?.nativeElement;
    if (!video?.videoWidth || !video.videoHeight) {
      this.cameraError = this.t.cameraNotReady;
      return;
    }
    const side = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, 240, 240);
    const webp = canvas.toDataURL('image/webp', 0.4);
    this.capturedSelfie = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.4);
    this.stopCamera();
  }

  useSelfie(): void {
    if (this.capturedSelfie) this.confirmedSelfie = this.capturedSelfie;
  }

  retakeSelfie(): void {
    this.resetSelfie();
    void this.openCamera();
  }

  private resetSelfie(): void {
    this.stopCamera();
    this.capturedSelfie = null;
    this.confirmedSelfie = null;
    this.cameraError = '';
  }

  private stopCamera(): void {
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = null;
    this.cameraOpen = false;
    if (this.cameraPreview?.nativeElement) {
      this.cameraPreview.nativeElement.srcObject = null;
    }
  }

  private scheduleFeedbackReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      this.feedback = null;
    }, 7000);
  }

  private initMap(): void {
    if (!this.mapContainer) {
      return;
    }

    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.map.setView([45.7983, 24.1256], 7);
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private requestFreshLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.locationState = 'unsupported';
      return;
    }

    this.locationState = 'loading';

    navigator.geolocation.getCurrentPosition(
      (position) => this.handlePosition(position),
      (error) => this.handlePositionError(error),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  }

  private handlePosition(position: GeolocationPosition): void {
    this.currentPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
    this.locationCapturedAt = new Date();
    this.locationState = 'ready';
    this.updateUserLayers();
  }

  private handlePositionError(error: GeolocationPositionError): void {
    if (error.code === error.PERMISSION_DENIED) {
      this.locationState = 'denied';
      return;
    }

    this.locationState = 'error';
  }

  private updateUserLayers(): void {
    if (!this.map || !this.currentPosition) {
      return;
    }

    const latLng = L.latLng(this.currentPosition.lat, this.currentPosition.lng);
    const color = '#2563eb';

    if (!this.userMarker) {
      this.userMarker = L.circleMarker(latLng, {
        radius: 9,
        color,
        weight: 3,
        fillColor: color,
        fillOpacity: 0.95
      }).addTo(this.map);
    } else {
      this.userMarker.setLatLng(latLng);
      this.userMarker.setStyle({ color, fillColor: color });
    }

    if (!this.accuracyCircle) {
      this.accuracyCircle = L.circle(latLng, {
        radius: this.currentPosition.accuracy,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.08
      }).addTo(this.map);
    } else {
      this.accuracyCircle.setLatLng(latLng);
      this.accuracyCircle.setRadius(this.currentPosition.accuracy);
      this.accuracyCircle.setStyle({ color, fillColor: color });
    }

    this.map.setView(latLng, 16, { animate: false });
  }

  private formatRemainingTime(remainingMs: number): string {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
