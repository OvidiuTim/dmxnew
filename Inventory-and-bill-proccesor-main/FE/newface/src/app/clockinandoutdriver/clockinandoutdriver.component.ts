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

  pin = '';
  submitting = false;
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
  }

  get formattedDate(): string {
    return new Intl.DateTimeFormat('ro-RO', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(this.currentTime);
  }

  get formattedTime(): string {
    return new Intl.DateTimeFormat('ro-RO', {
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
    return !!this.pin.trim() && !!this.currentPosition && this.effectiveLocationState === 'ready' && !this.submitting;
  }

  get locationBadge(): string {
    return {
      idle: 'Locatie necesara',
      loading: 'GPS se conecteaza',
      ready: 'Locatie gata',
      expired: 'Locatie expirata',
      denied: 'GPS blocat',
      unsupported: 'GPS indisponibil',
      error: 'GPS instabil'
    }[this.effectiveLocationState];
  }

  get locationTitle(): string {
    return {
      idle: 'Ia mai intai locatia curenta a telefonului.',
      loading: 'Cerem locatia curenta a telefonului.',
      ready: 'Locatia ta actuala este gata pentru pontaj.',
      expired: 'Locatia GPS salvata a expirat.',
      denied: 'Nu avem acces la localizarea telefonului.',
      unsupported: 'Browserul nu suporta localizarea.',
      error: 'Nu am reusit sa citim locatia curenta.'
    }[this.effectiveLocationState];
  }

  get locationDetail(): string {
    return {
      idle: 'Apasa pe Ia-mi locatia mea live. Dupa ce locatia este capturata, ai 10 minute sa introduci PIN-ul.',
      loading: 'Soferii pot face check-in de oriunde, dar locatia GPS este obligatorie si va fi salvata impreuna cu pontajul.',
      ready: 'Locatia este afisata pe harta si va fi salvata la check-in sau check-out.',
      expired: 'Apasa din nou pe Ia-mi locatia mea live. Pozitia salvata poate fi folosita pentru pontaj doar 10 minute.',
      denied: 'Permite accesul la locatie in browser si apasa din nou pe Ia-mi locatia mea live.',
      unsupported: 'Deschide pagina intr-un browser modern de pe telefonul soferului.',
      error: 'Verifica semnalul GPS si incearca din nou.'
    }[this.effectiveLocationState];
  }

  get locationFreshForLabel(): string | null {
    if (!this.locationCapturedAt || !this.isLocationFresh) {
      return null;
    }

    const remainingMs = Math.max(0, this.locationValidityMs - (this.currentTime.getTime() - this.locationCapturedAt.getTime()));
    return `Locatia este valabila inca ${this.formatRemainingTime(remainingMs)}.`;
  }

  get locationReadyHint(): string {
    if (!this.currentPosition) {
      return 'Pontajul este blocat pana cand pozitia curenta este disponibila.';
    }

    if (this.effectiveLocationState === 'expired') {
      return 'Locatia salvata a expirat. Apasa din nou pe Ia-mi locatia mea live inainte sa introduci PIN-ul.';
    }

    return `Pozitie curenta: ${this.formatCoordinates(this.currentPosition.lat, this.currentPosition.lng)}. Acuratete aproximativa: ${Math.round(this.currentPosition.accuracy)} m.`;
  }

  get gateMessage(): string {
    if (!this.currentPosition) {
      return 'Pontajul este permis doar dupa ce vezi locatia ta curenta pe harta.';
    }

    if (this.effectiveLocationState === 'expired') {
      return 'Locatia a expirat. Apasa din nou pe Ia-mi locatia mea live si introdu PIN-ul in maximum 10 minute.';
    }

    if (this.effectiveLocationState === 'ready') {
      return 'Locatia este gata si poate fi salvata impreuna cu pontajul.';
    }

    return 'Pontajul este permis doar dupa ce vezi locatia ta curenta pe harta.';
  }

  updatePin(value: string): void {
    this.pin = value.replace(/\D/g, '').slice(0, 12);
  }

  clearPin(): void {
    this.pin = '';
  }

  refreshLocation(): void {
    this.requestFreshLocation();
  }

  submitPin(): void {
    if (!this.currentPosition) {
      this.showError('Locatia GPS este obligatorie pentru pontajul soferilor.');
      return;
    }

    if (this.effectiveLocationState === 'expired') {
      this.showError('Locatia GPS salvata a expirat. Apasa din nou pe Ia-mi locatia mea live si introdu PIN-ul in maximum 10 minute.');
      return;
    }

    if (this.effectiveLocationState !== 'ready') {
      this.showError('Locatia GPS este obligatorie pentru pontajul soferilor.');
      return;
    }

    const cleanPin = this.pin.trim();
    this.submitting = true;

    this.api.manualAttendanceByPin(cleanPin, {
      mode: 'driver',
      gps: {
        lat: this.currentPosition.lat,
        lng: this.currentPosition.lng,
        accuracy: this.currentPosition.accuracy,
        capturedAt: this.locationCapturedAt?.toISOString()
      }
    }).subscribe({
      next: (response) => {
        this.submitting = false;

        if (response?.debounced) {
          return;
        }

        if (!response?.user?.name || !response?.state) {
          this.showError('Nu am gasit niciun angajat cu acest PIN.');
          this.clearPin();
          return;
        }

        this.showAttendanceFeedback(response.state, response.user.name);
        this.clearPin();
      },
      error: (error) => {
        this.submitting = false;
        this.showError(this.resolveAttendanceError(error));
        this.clearPin();
      }
    });
  }

  formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  private showAttendanceFeedback(state: AttendanceState, userName: string): void {
    const locationText = this.currentPosition
      ? ` Locatie salvata: ${this.formatCoordinates(this.currentPosition.lat, this.currentPosition.lng)}.`
      : '';

    this.feedback = state === 'ENTER'
      ? {
          kind: 'enter',
          title: 'Check-in salvat',
          message: `${userName}, te-ai pontat cu succes ca sofer.${locationText}`,
          stamp: `Inregistrat la ${this.formattedTime}`
        }
      : {
          kind: 'exit',
          title: 'Check-out salvat',
          message: `${userName}, te-ai depontat cu succes ca sofer.${locationText}`,
          stamp: `Inregistrat la ${this.formattedTime}`
        };

    this.scheduleFeedbackReset();
  }

  private showError(message: string): void {
    this.feedback = {
      kind: 'error',
      title: 'Actiune blocata',
      message,
      stamp: `Inregistrat la ${this.formattedTime}`
    };

    this.scheduleFeedbackReset();
  }

  private resolveAttendanceError(error: any): string {
    const code = typeof error?.error?.error_code === 'string' ? error.error.error_code : '';
    if (code === 'MANUAL_DEVICE_LOCKED') {
      return 'Telefonul sau browserul acesta are deja un check-in activ pentru alt muncitor. Pe acest dispozitiv poti face acum doar check-out pentru muncitorul pontat primul.';
    }

    if (code === 'MANUAL_CHECKOUT_DEVICE_MISMATCH') {
      return 'Check-out-ul pentru acest muncitor trebuie facut de pe acelasi telefon sau browser folosit la check-in.';
    }

    if (code === 'GPS_REQUIRED_FOR_DRIVER') {
      return 'Locatia GPS este obligatorie pentru pontajul soferilor.';
    }

    if (code === 'GPS_CAPTURE_EXPIRED') {
      return 'Locatia GPS salvata a expirat. Apasa din nou pe Ia-mi locatia mea live si introdu PIN-ul in maximum 10 minute.';
    }

    return typeof error?.error?.error === 'string'
      ? error.error.error
      : 'Nu am putut inregistra pontajul acum. Incearca din nou.';
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
