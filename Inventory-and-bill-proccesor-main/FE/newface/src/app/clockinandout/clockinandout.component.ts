import { attendanceCopy, TranslationPack } from '../i18n/attendance-copy';
import { readEmployeeLanguage, saveEmployeeLanguage } from '../i18n/employee-language';
import { employeeCopy } from '../i18n/employee-copy';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { SharedService } from '../shared.service';

type LanguageCode = 'ro' | 'en' | 'pa' | 'hi' | 'ne';
type FeedbackKind = 'enter' | 'exit' | 'error';
type AttendanceState = 'ENTER' | 'EXIT';
type LocationState = 'idle' | 'loading' | 'inside' | 'outside' | 'expired' | 'denied' | 'unsupported' | 'error';
type WorksiteType = 'polygon' | 'circle';

interface LanguageOption {
  code: LanguageCode;
  nativeLabel: string;
  secondaryLabel: string;
  locale: string;
}

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

interface WorksiteDefinition {
  name: string;
  type: WorksiteType;
  center: { lat: number; lng: number };
  polygon?: L.LatLngTuple[];
  radiusMeters?: number;
}


@Component({
  selector: 'app-clockinandout',
  templateUrl: './clockinandout.component.html',
  styleUrls: ['./clockinandout.component.css']
})
export class ClockinandoutComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('cameraPreview') cameraPreview?: ElementRef<HTMLVideoElement>;

  readonly languages: LanguageOption[] = [
    { code: 'ro', nativeLabel: 'Română', secondaryLabel: 'Romanian', locale: 'ro-RO' },
    { code: 'en', nativeLabel: 'English', secondaryLabel: 'English', locale: 'en-GB' },
    { code: 'pa', nativeLabel: 'ਪੰਜਾਬੀ', secondaryLabel: 'Punjabi', locale: 'pa-IN' },
    { code: 'hi', nativeLabel: 'हिन्दी', secondaryLabel: 'Hindi', locale: 'hi-IN' },
    { code: 'ne', nativeLabel: 'नेपाली', secondaryLabel: 'Nepali', locale: 'ne-NP' }
  ];

  readonly sharedLakeHomeCenter = { lat: 45.81034964338528, lng: 24.130413480467038 };
  readonly chefWorksite: WorksiteDefinition = {
    name: 'Birou ingineri',
    type: 'circle',
    center: { lat: 45.79680855369633, lng: 24.14230494031001 },
    radiusMeters: 100,
  };

  readonly worksites: WorksiteDefinition[] = [
    { name: 'The Lake Home Bloc A', type: 'circle', center: this.sharedLakeHomeCenter, radiusMeters: 90 },
    { name: 'The Lake Home Bloc B2', type: 'circle', center: this.sharedLakeHomeCenter, radiusMeters: 40 },
    { name: 'The Lake Home Bloc E & F', type: 'circle', center: this.sharedLakeHomeCenter, radiusMeters: 40 },
    { name: 'Birou ingineri & TESA', type: 'circle', center: { lat: 45.809820427020156, lng: 24.13019018453687 }, radiusMeters: 100 },
    { name: 'Psihiatrie C8', type: 'circle', center: { lat: 45.80720228440877, lng: 24.15440514734915 }, radiusMeters: 40 },
    { name: 'Psihiatrie C16', type: 'circle', center: { lat: 45.80768553302182, lng: 24.157085884823974 }, radiusMeters: 40 },
    { name: 'Spital Victoria', type: 'circle', center: { lat: 45.725861888407216, lng: 24.70584969156609 }, radiusMeters: 40 },
    { name: 'Casa de Cultură Victoria', type: 'circle', center: { lat: 45.73050790281027, lng: 24.70109770865094 }, radiusMeters: 40 },
    { name: 'Bazin Ucea', type: 'circle', center: { lat: 45.70058115535115, lng: 24.689376326811146 }, radiusMeters: 40 },
    { name: 'Bloc Agnita', type: 'circle', center: { lat: 45.97724541353617, lng: 24.62272565333796 }, radiusMeters: 40 },
    { name: 'Grădinița Agnita', type: 'circle', center: { lat: 45.97789754940184, lng: 24.61674765866955 }, radiusMeters: 40 },
    { name: 'Bloc 14 Victoria', type: 'circle', center: { lat: 45.73336901742498, lng: 24.701707107591304 }, radiusMeters: 40 },
    { name: 'Bloc 3 Victoria', type: 'circle', center: { lat: 45.73105012404724, lng: 24.696154238062714 }, radiusMeters: 40 },
    { name: 'Cisnadie', type: 'circle', center: { lat: 45.71648035800439, lng: 24.162636701234426 }, radiusMeters: 50 },
    { name: 'The River chalet', type: 'circle', center: { lat: 45.76837384893173, lng: 23.916721618503065 }, radiusMeters: 50 }
  ];

  readonly translations = attendanceCopy;

  selectedLanguage: LanguageCode = this.readSavedLanguage();
  chefMode = false;
  portalMode = false;
  portalUnreadNotifications = 0;
  selectedWorksite: WorksiteDefinition | null = null;
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
  private zoneShape: L.Polygon | L.Circle | null = null;
  private zoneCenterMarker: L.CircleMarker | null = null;
  private userMarker: L.CircleMarker | null = null;
  private accuracyCircle: L.Circle | null = null;
  private watchId: number | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private portalRedirectTimer: ReturnType<typeof setTimeout> | null = null;
  private portalNotificationTimer: ReturnType<typeof setInterval> | null = null;
  private cameraStream: MediaStream | null = null;

  constructor(
    private api: SharedService,
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.chefMode = this.route.snapshot.data['chefMode'] === true;
    this.portalMode = this.route.snapshot.data['portalMode'] === true;
    if (this.portalMode) {
      this.selectedLanguage = this.readPortalLanguage();
      this.loadPortalNotificationCount();
      this.portalNotificationTimer = setInterval(() => this.loadPortalNotificationCount(), 15000);
    }
    if (this.chefMode) {
      this.selectedWorksite = this.chefWorksite;
    }
    this.clockTimer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngAfterViewInit(): void {
    this.initMap();
    if (this.selectedWorksite) {
      this.updateZoneVisualization();
    }
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    if (this.portalRedirectTimer) {
      clearTimeout(this.portalRedirectTimer);
    }
    if (this.portalNotificationTimer) {
      clearInterval(this.portalNotificationTimer);
    }

    this.stopGeolocation();
    this.stopCamera();
    this.map?.remove();
  }

  get ui() { return employeeCopy[this.selectedLanguage]; }

  get t(): TranslationPack {
    return this.translations[this.selectedLanguage];
  }

  get portalIdentityTitle(): string {
    return {
      ro: 'Confirmă identitatea',
      en: 'Confirm identity',
      pa: 'ਪਛਾਣ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ',
      hi: 'पहचान की पुष्टि करें',
      ne: 'पहिचान पुष्टि गर्नुहोस्',
    }[this.selectedLanguage];
  }

  get formattedDate(): string {
    return new Intl.DateTimeFormat(this.currentLocale, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(this.currentTime);
  }

  get formattedTime(): string {
    return new Intl.DateTimeFormat(this.currentLocale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(this.currentTime);
  }

  get currentLocale(): string {
    return this.languages.find((language) => language.code === this.selectedLanguage)?.locale ?? 'ro-RO';
  }

  get activeZoneCenter(): { lat: number; lng: number } {
    return this.selectedWorksite?.center ?? this.sharedLakeHomeCenter;
  }

  get canSubmit(): boolean {
    return (this.portalMode || !!this.pin.trim())
      && (!this.chefMode || this.pin.trim() === '1165')
      && !!this.selectedWorksite
      && this.effectiveLocationState === 'inside'
      && this.dataProcessingConsent
      && !!this.confirmedSelfie
      && !this.submitting;
  }

  get gateReady(): boolean {
    return !!this.selectedWorksite && this.effectiveLocationState === 'inside';
  }

  get effectiveLocationState(): LocationState {
    if (this.locationState === 'inside' || this.locationState === 'outside') {
      return this.isLocationFresh ? this.locationState : 'expired';
    }

    if (this.currentPosition && this.locationCapturedAt && !this.isLocationFresh) {
      return 'expired';
    }

    return this.locationState;
  }

  get isLocationFresh(): boolean {
    if (!this.locationCapturedAt) {
      return false;
    }

    return (this.currentTime.getTime() - this.locationCapturedAt.getTime()) <= this.locationValidityMs;
  }

  get locationFreshForLabel(): string | null {
    if (!this.locationCapturedAt || !this.isLocationFresh) {
      return null;
    }

    const remainingMs = Math.max(0, this.locationValidityMs - (this.currentTime.getTime() - this.locationCapturedAt.getTime()));
    return this.getLocationFreshForText(this.formatRemainingTime(remainingMs));
  }

  get gateMessage(): string {
    if (!this.selectedWorksite) {
      return this.t.worksiteRequired;
    }

    const state = this.effectiveLocationState;
    if (state === 'idle') {
      return this.getLocationMissingErrorText();
    }

    if (state === 'expired') {
      return this.getLocationExpiredErrorText();
    }

    if (state === 'loading') {
      return this.t.gpsLoadingDetail;
    }

    if (this.chefMode && this.pin.trim() && this.pin.trim() !== '1165') {
      return this.ui.chefPin;
    }

    if (!this.dataProcessingConsent) {
      return this.t.consentRequired;
    }

    if (!this.confirmedSelfie) {
      return this.t.selfieRequired;
    }

    if (state === 'inside') {
      return this.t.zoneAllowed;
    }

    if (state === 'outside') {
      return this.t.zoneRestriction;
    }

    return this.locationDetail;
  }

  get locationBadge(): string {
    if (!this.selectedWorksite) {
      return this.t.worksitePlaceholder;
    }

    const state = this.effectiveLocationState;
    if (state === 'idle' || state === 'expired') {
      return this.getLocationCopy(state).badge;
    }

    return {
      idle: this.t.worksitePlaceholder,
      loading: this.t.gpsLoadingBadge,
      inside: this.t.gpsInsideBadge,
      outside: this.t.gpsOutsideBadge,
      expired: this.t.gpsOutsideBadge,
      denied: this.t.gpsDeniedBadge,
      unsupported: this.t.gpsUnsupportedBadge,
      error: this.t.gpsErrorBadge
    }[state];
  }

  get locationTitle(): string {
    if (!this.selectedWorksite) {
      return this.t.worksiteLabel;
    }

    const state = this.effectiveLocationState;
    if (state === 'idle' || state === 'expired') {
      return this.getLocationCopy(state).title;
    }

    return {
      idle: this.t.worksiteLabel,
      loading: this.t.gpsLoadingTitle,
      inside: this.t.gpsInsideTitle,
      outside: this.t.gpsOutsideTitle,
      expired: this.t.gpsOutsideTitle,
      denied: this.t.gpsDeniedTitle,
      unsupported: this.t.gpsUnsupportedTitle,
      error: this.t.gpsErrorTitle
    }[state];
  }

  get locationDetail(): string {
    if (!this.selectedWorksite) {
      return this.t.worksiteHelper;
    }

    const state = this.effectiveLocationState;
    if (state === 'idle' || state === 'expired') {
      return this.getLocationCopy(state).detail;
    }

    return {
      idle: this.t.worksiteHelper,
      loading: this.t.gpsLoadingDetail,
      inside: this.t.gpsInsideDetail,
      outside: this.t.gpsOutsideDetail,
      expired: this.t.gpsOutsideDetail,
      denied: this.t.gpsDeniedDetail,
      unsupported: this.t.gpsUnsupportedDetail,
      error: this.t.gpsErrorDetail
    }[state];
  }

  setLanguage(code: LanguageCode): void {
    this.selectedLanguage = code;
    saveEmployeeLanguage(code);
    this.updateZoneTooltip();
  }

  goBack(): void {
    const origin = window.history.state?.teamDashboardOrigin;
    if (typeof origin === 'string' && origin.startsWith('/team-dashboard') && origin !== this.router.url) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl('/team-dashboard');
  }

  goToTeamDashboard(): void {
    void this.router.navigateByUrl('/team-dashboard');
  }

  openPortalNotifications(): void {
    void this.router.navigateByUrl('/team-dashboard/notificari', {
      state: { teamDashboardOrigin: this.router.url },
    });
  }

  private loadPortalNotificationCount(): void {
    this.api.getTeamPortalNotificationSummary().subscribe({
      next: data => this.portalUnreadNotifications = Number(data.unread_count || 0),
    });
  }

  get selectedWorksiteName(): string {
    return this.selectedWorksite?.name ?? '';
  }

  setWorksite(worksite: WorksiteDefinition | null): void {
    this.selectedWorksite = worksite;
    this.updateZoneVisualization();

    if (!worksite) {
      this.stopGeolocation();
      this.locationState = 'idle';
      return;
    }

    if (this.currentPosition) {
      this.recomputeZoneMembership();
      this.updateUserLayers();
      return;
    }

    this.locationState = 'idle';
  }

  updatePin(value: string): void {
    const nextPin = value.replace(/\D/g, '').slice(0, 12);
    if (nextPin !== this.pin && (this.cameraOpen || this.capturedSelfie || this.confirmedSelfie)) {
      this.resetSelfie();
    }
    this.pin = nextPin;
  }

  clearPin(): void {
    this.pin = '';
    this.resetSelfie();
  }

  refreshLocation(): void {
    if (!this.selectedWorksite) {
      this.showError(this.t.worksiteRequired);
      return;
    }

    this.requestFreshLocation();
  }

  submitPin(): void {
    if (!this.selectedWorksite) {
      this.showError(this.t.worksiteRequired);
      return;
    }

    if (!this.currentPosition) {
      this.showError(this.getLocationMissingErrorText());
      return;
    }

    if (this.effectiveLocationState === 'expired') {
      this.showError(this.getLocationExpiredErrorText());
      return;
    }

    if (this.chefMode && this.pin.trim() !== '1165') {
      this.showError(this.ui.chefPin);
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

    if (!this.canSubmit) {
      this.showError(this.t.zoneRestriction);
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
        if (!this.portalMode) this.clearPin();
        else {
          this.resetSelfie();
          this.portalRedirectTimer = setTimeout(() => {
            void this.router.navigateByUrl('/team-dashboard');
          }, 1300);
        }
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
    this.feedback = state === 'ENTER'
      ? {
          kind: 'enter',
          title: this.t.enterTitle,
          message: this.t.successEnter(userName),
          stamp: this.t.processedAt(this.formattedTime)
        }
      : {
          kind: 'exit',
          title: this.t.exitTitle,
          message: this.t.successExit(userName),
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
    switch (code) {
      case 'GPS_CAPTURE_EXPIRED': case 'GPS_LOCATION_EXPIRED': return this.getLocationExpiredErrorText();
      case 'GPS_REQUIRED': case 'GPS_CAPTURE_TIME_REQUIRED': case 'GPS_REQUIRED_FOR_DRIVER': return this.getLocationMissingErrorText();
      case 'OUTSIDE_WORKSITE_AREA': return this.t.gpsOutsideDetail;
      case 'DATA_PROCESSING_CONSENT_REQUIRED': return this.t.consentRequired;
      case 'ATTENDANCE_PHOTO_REQUIRED': return this.t.selfieRequired;
      case 'MANUAL_DEVICE_LOCKED': return this.ui.deviceLocked;
      case 'MANUAL_CHECKOUT_DEVICE_MISMATCH': return this.ui.sameDevice;
      case 'INVALID_PIN': case 'EMPLOYEE_NOT_FOUND': return this.t.invalidPin;
      default: return this.selectedLanguage === 'ro' && typeof error?.error?.error === 'string'
        ? error.error.error : this.t.genericError;
    }
  }

  private submitAttendanceRequest(pin: string, attendancePhoto: string) {
    const options = {
      worksite: this.selectedWorksite!.name,
      mode: (this.chefMode ? 'chef' : 'manual') as 'chef' | 'manual',
      gps: {
        lat: this.currentPosition!.lat,
        lng: this.currentPosition!.lng,
        accuracy: this.currentPosition!.accuracy,
        capturedAt: this.locationCapturedAt?.toISOString()
      },
      dataProcessingConsent: this.dataProcessingConsent,
      attendancePhoto,
    };
    return this.portalMode
      ? this.api.teamPortalAttendance(options)
      : this.api.manualAttendanceByPin(pin, options);
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
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 640 },
          height: { ideal: 640 }
        }
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

  private updateZoneVisualization(): void {
    if (!this.map) {
      return;
    }

    if (this.zoneShape) {
      this.map.removeLayer(this.zoneShape);
      this.zoneShape = null;
    }

    if (this.zoneCenterMarker) {
      this.map.removeLayer(this.zoneCenterMarker);
      this.zoneCenterMarker = null;
    }

    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
      this.userMarker = null;
    }

    if (this.accuracyCircle) {
      this.map.removeLayer(this.accuracyCircle);
      this.accuracyCircle = null;
    }

    const worksite = this.selectedWorksite;
    if (!worksite) {
      this.map.setView([45.7983, 24.1256], 7);
      return;
    }

    this.zoneShape = worksite.type === 'polygon'
      ? L.polygon(worksite.polygon!, {
          color: '#0f766e',
          weight: 2,
          fillColor: '#0f766e',
          fillOpacity: 0.14
        }).addTo(this.map)
      : L.circle([worksite.center.lat, worksite.center.lng], {
          radius: worksite.radiusMeters!,
          color: '#0f766e',
          weight: 2,
          fillColor: '#0f766e',
          fillOpacity: 0.14
        }).addTo(this.map);

    this.zoneCenterMarker = L.circleMarker([worksite.center.lat, worksite.center.lng], {
      radius: 7,
      color: '#0f766e',
      weight: 2,
      fillColor: '#f8fafc',
      fillOpacity: 1
    }).addTo(this.map);

    this.updateZoneTooltip();

    this.focusMapOnWorksite(worksite);
  }

  private requestFreshLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.locationState = 'unsupported';
      return;
    }

    this.stopGeolocation();
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

  private stopGeolocation(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private handlePosition(position: GeolocationPosition): void {
    this.currentPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
    this.locationCapturedAt = new Date();

    this.recomputeZoneMembership();
    this.updateUserLayers();
  }

  private handlePositionError(error: GeolocationPositionError): void {
    if (error.code === error.PERMISSION_DENIED) {
      this.locationState = 'denied';
      return;
    }

    this.locationState = 'error';
  }

  private recomputeZoneMembership(): void {
    if (!this.currentPosition) {
      this.locationState = 'loading';
      return;
    }

    const worksite = this.selectedWorksite;
    if (!worksite) {
      this.locationState = 'loading';
      return;
    }

    this.locationState = this.pointInsideWorksite(this.currentPosition, worksite) ? 'inside' : 'outside';
  }

  private updateUserLayers(): void {
    if (!this.map || !this.currentPosition || !this.selectedWorksite) {
      return;
    }

    const inside = this.locationState === 'inside';
    const color = inside ? '#0f766e' : '#d97706';
    const latLng = L.latLng(this.currentPosition.lat, this.currentPosition.lng);

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
    this.focusMapOnCurrentContext();
  }

  private focusMapOnWorksite(worksite: WorksiteDefinition): void {
    if (!this.map) {
      return;
    }

    if (worksite.type === 'circle') {
      this.map.setView([worksite.center.lat, worksite.center.lng], 18, { animate: false });

      setTimeout(() => {
        this.map?.invalidateSize();
        this.map?.setView([worksite.center.lat, worksite.center.lng], 18, { animate: false });
      }, 50);
      return;
    }

    const zoneBounds = this.getWorksiteBounds(worksite).pad(0.22);
    this.map.fitBounds(zoneBounds, { maxZoom: 18, animate: false });

    setTimeout(() => {
      this.map?.invalidateSize();
      this.map?.fitBounds(zoneBounds, { maxZoom: 18, animate: false });
    }, 50);
  }

  private focusMapOnCurrentContext(): void {
    if (!this.map || !this.selectedWorksite || !this.currentPosition) {
      return;
    }

    const worksiteBounds = this.getWorksiteBounds(this.selectedWorksite);
    const userLatLng = L.latLng(this.currentPosition.lat, this.currentPosition.lng);
    const siteCenter = L.latLng(this.selectedWorksite.center.lat, this.selectedWorksite.center.lng);
    const distanceToWorksite = userLatLng.distanceTo(siteCenter);

    if (distanceToWorksite > 250) {
      return;
    }

    const combinedBounds = worksiteBounds.extend(userLatLng).pad(0.28);
    this.map.fitBounds(combinedBounds, { maxZoom: 18, animate: false });
  }

  private pointInsideWorksite(position: CurrentPosition, worksite: WorksiteDefinition): boolean {
    if (worksite.type === 'circle') {
      return L.latLng(position.lat, position.lng).distanceTo(L.latLng(worksite.center.lat, worksite.center.lng)) <= (worksite.radiusMeters ?? 0);
    }

    return this.pointInsidePolygon(position.lat, position.lng, worksite.polygon ?? []);
  }

  private pointInsidePolygon(lat: number, lng: number, polygon: L.LatLngTuple[]): boolean {
    if (!polygon.length) {
      return false;
    }

    if (this.isPointOnPolygonEdge(lat, lng, polygon)) {
      return true;
    }

    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const yi = polygon[i][0];
      const xi = polygon[i][1];
      const yj = polygon[j][0];
      const xj = polygon[j][1];

      const intersects = ((yi > lat) !== (yj > lat)) &&
        (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  private isPointOnPolygonEdge(lat: number, lng: number, polygon: L.LatLngTuple[]): boolean {
    const tolerance = 0.0000005;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const ay = polygon[j][0];
      const ax = polygon[j][1];
      const by = polygon[i][0];
      const bx = polygon[i][1];

      const cross = Math.abs((lng - ax) * (by - ay) - (lat - ay) * (bx - ax));
      if (cross > tolerance) {
        continue;
      }

      const dot = (lng - ax) * (bx - ax) + (lat - ay) * (by - ay);
      if (dot < 0) {
        continue;
      }

      const lenSq = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
      if (dot <= lenSq) {
        return true;
      }
    }

    return false;
  }

  private computePolygonCenter(points: L.LatLngTuple[]): { lat: number; lng: number } {
    return {
      lat: points.reduce((sum, point) => sum + point[0], 0) / points.length,
      lng: points.reduce((sum, point) => sum + point[1], 0) / points.length
    };
  }

  private getWorksiteBounds(worksite: WorksiteDefinition): L.LatLngBounds {
    return worksite.type === 'polygon'
      ? L.latLngBounds(worksite.polygon!)
      : L.circle([worksite.center.lat, worksite.center.lng], { radius: worksite.radiusMeters! }).getBounds();
  }

  private updateZoneTooltip(): void {
    if (!this.zoneCenterMarker) {
      return;
    }

    const label = this.selectedWorksite?.name || this.t.worksitePlaceholder;
    this.zoneCenterMarker.unbindTooltip();
    this.zoneCenterMarker.bindTooltip(label, {
      permanent: false,
      direction: 'top'
    });
  }

  private formatRemainingTime(remainingMs: number): string {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private getLocationFreshForText(time: string): string {
    switch (this.selectedLanguage) {
      case 'en':
        return `Location valid for ${time}.`;
      case 'pa':
        return `ਲੋਕੇਸ਼ਨ ਹੋਰ ${time} ਲਈ ਵੈਧ ਹੈ।`;
      case 'hi':
        return `लोकेशन ${time} तक मान्य है।`;
      case 'ne':
        return `लोकेशन अझै ${time} सम्म मान्य छ।`;
      default:
        return `Locatia este valabila inca ${time}.`;
    }
  }

  private getLocationMissingErrorText(): string {
    switch (this.selectedLanguage) {
      case 'en':
        return 'Press Get my live location and then enter the PIN within 10 minutes.';
      case 'pa':
        return 'ਪਹਿਲਾਂ ਮੇਰੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਲਵੋ ਦਬਾਓ, ਫਿਰ 10 ਮਿੰਟਾਂ ਅੰਦਰ ਪਿੰਨ ਦਾਖਲ ਕਰੋ।';
      case 'hi':
        return 'पहले मेरी लाइव लोकेशन लो दबाएं, फिर 10 मिनट के भीतर पिन दर्ज करें।';
      case 'ne':
        return 'पहिले मेरो हालको लोकेशन लिनुहोस् थिच्नुहोस्, त्यसपछि १० मिनेटभित्र पिन हाल्नुहोस्।';
      default:
        return 'Apasa pe Ia-mi locatia mea live, apoi introdu PIN-ul in maximum 10 minute.';
    }
  }

  private getLocationExpiredErrorText(): string {
    switch (this.selectedLanguage) {
      case 'en':
        return 'The saved location expired. Press Get my live location again and then enter the PIN within 10 minutes.';
      case 'pa':
        return 'ਸੇਵ ਕੀਤੀ ਲੋਕੇਸ਼ਨ ਮਿਆਦ ਤੋਂ ਬਾਹਰ ਹੋ ਗਈ ਹੈ। ਦੁਬਾਰਾ ਮੇਰੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਲਵੋ ਦਬਾਓ ਅਤੇ 10 ਮਿੰਟਾਂ ਅੰਦਰ ਪਿੰਨ ਦਾਖਲ ਕਰੋ।';
      case 'hi':
        return 'सहेजी गई लोकेशन की समय-सीमा खत्म हो गई है। फिर से मेरी लाइव लोकेशन लो दबाएं और 10 मिनट के भीतर पिन दर्ज करें।';
      case 'ne':
        return 'सेभ गरिएको लोकेशनको समय सकिएको छ। फेरि मेरो हालको लोकेशन लिनुहोस् थिच्नुहोस् र १० मिनेटभित्र पिन हाल्नुहोस्।';
      default:
        return 'Locatia salvata a expirat. Apasa din nou pe Ia-mi locatia mea live si introdu PIN-ul in maximum 10 minute.';
    }
  }

  private getLocationCopy(state: 'idle' | 'expired'): { badge: string; title: string; detail: string } {
    if (state === 'expired') {
      switch (this.selectedLanguage) {
        case 'en':
          return {
            badge: 'Location expired',
            title: 'The saved GPS location has expired.',
            detail: 'Press Get my live location again. The saved position can be used for attendance for 10 minutes only.'
          };
        case 'pa':
          return {
            badge: 'ਲੋਕੇਸ਼ਨ ਮਿਆਦ ਖਤਮ',
            title: 'ਸੇਵ ਕੀਤੀ GPS ਲੋਕੇਸ਼ਨ ਦੀ ਮਿਆਦ ਖਤਮ ਹੋ ਗਈ ਹੈ।',
            detail: 'ਦੁਬਾਰਾ ਮੇਰੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਲਵੋ ਦਬਾਓ। ਸੇਵ ਕੀਤੀ ਲੋਕੇਸ਼ਨ ਸਿਰਫ਼ 10 ਮਿੰਟ ਲਈ ਹੀ ਵਰਤੀ ਜਾ ਸਕਦੀ ਹੈ।'
          };
        case 'hi':
          return {
            badge: 'लोकेशन समाप्त',
            title: 'सहेजी गई GPS लोकेशन की समय-सीमा समाप्त हो गई है।',
            detail: 'फिर से मेरी लाइव लोकेशन लो दबाएं। सहेजी गई लोकेशन केवल 10 मिनट तक मान्य रहती है।'
          };
        case 'ne':
          return {
            badge: 'लोकेशन सकियो',
            title: 'सेभ गरिएको GPS लोकेशनको समय सकिएको छ।',
            detail: 'फेरि मेरो हालको लोकेशन लिनुहोस् थिच्नुहोस्। सेभ गरिएको लोकेशन १० मिनेट मात्र मान्य हुन्छ।'
          };
        default:
          return {
            badge: 'Locatie expirata',
            title: 'Locatia GPS salvata a expirat.',
            detail: 'Apasa din nou pe Ia-mi locatia mea live. Pozitia salvata poate fi folosita pentru pontaj doar 10 minute.'
          };
      }
    }

    switch (this.selectedLanguage) {
      case 'en':
        return {
          badge: 'Location needed',
          title: 'Capture your current GPS location first.',
          detail: 'Press Get my live location. After the location is captured, you have 10 minutes to enter the PIN.'
        };
      case 'pa':
        return {
          badge: 'ਲੋਕੇਸ਼ਨ ਚਾਹੀਦੀ ਹੈ',
          title: 'ਸਭ ਤੋਂ ਪਹਿਲਾਂ ਆਪਣੀ ਮੌਜੂਦਾ GPS ਲੋਕੇਸ਼ਨ ਲਵੋ।',
          detail: 'ਮੇਰੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਲਵੋ ਦਬਾਓ। ਲੋਕੇਸ਼ਨ ਮਿਲਣ ਤੋਂ ਬਾਅਦ ਤੁਹਾਡੇ ਕੋਲ ਪਿੰਨ ਦਾਖਲ ਕਰਨ ਲਈ 10 ਮਿੰਟ ਹੋਣਗੇ।'
        };
      case 'hi':
        return {
          badge: 'लोकेशन चाहिए',
          title: 'पहले अपनी वर्तमान GPS लोकेशन लें।',
          detail: 'मेरी लाइव लोकेशन लो दबाएं। लोकेशन मिल जाने के बाद आपके पास पिन दर्ज करने के लिए 10 मिनट होंगे।'
        };
      case 'ne':
        return {
          badge: 'लोकेशन चाहिन्छ',
          title: 'पहिले आफ्नो हालको GPS लोकेशन लिनुहोस्।',
          detail: 'मेरो हालको लोकेशन लिनुहोस् थिच्नुहोस्। लोकेशन आएपछि पिन हाल्न १० मिनेट समय हुनेछ।'
        };
      default:
        return {
          badge: 'Locatie necesara',
          title: 'Ia mai intai locatia GPS curenta.',
          detail: 'Apasa pe Ia-mi locatia mea live. Dupa ce locatia este capturata, ai 10 minute sa introduci PIN-ul.'
        };
    }
  }

  private readSavedLanguage(): LanguageCode { return readEmployeeLanguage(); }

  private readPortalLanguage(): LanguageCode { return readEmployeeLanguage(); }
}
