import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { SharedService } from '../shared.service';

type FeedbackKind = 'enter' | 'exit' | 'error';
type AttendanceState = 'ENTER' | 'EXIT';
type LocationState = 'loading' | 'ready' | 'denied' | 'unsupported' | 'error';

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
  locationState: LocationState = 'loading';

  private map: L.Map | null = null;
  private userMarker: L.CircleMarker | null = null;
  private accuracyCircle: L.Circle | null = null;
  private watchId: number | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private hasCenteredOnUser = false;

  constructor(private api: SharedService) {}

  ngOnInit(): void {
    this.clockTimer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.startGeolocation();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.stopGeolocation();
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

  get canSubmit(): boolean {
    return !!this.pin.trim() && !!this.currentPosition && this.locationState === 'ready' && !this.submitting;
  }

  get locationBadge(): string {
    return {
      loading: 'GPS se conecteaza',
      ready: 'Locatie gata',
      denied: 'GPS blocat',
      unsupported: 'GPS indisponibil',
      error: 'GPS instabil'
    }[this.locationState];
  }

  get locationTitle(): string {
    return {
      loading: 'Cerem locatia curenta a telefonului.',
      ready: 'Locatia ta actuala este gata pentru pontaj.',
      denied: 'Nu avem acces la localizarea telefonului.',
      unsupported: 'Browserul nu suporta localizarea.',
      error: 'Nu am reusit sa citim locatia curenta.'
    }[this.locationState];
  }

  get locationDetail(): string {
    return {
      loading: 'Soferii pot face check-in de oriunde, dar locatia GPS este obligatorie si va fi salvata impreuna cu pontajul.',
      ready: 'Locatia este afisata pe harta si va fi salvata la check-in sau check-out.',
      denied: 'Permite accesul la locatie in browser si apasa din nou pe Actualizeaza GPS.',
      unsupported: 'Deschide pagina intr-un browser modern de pe telefonul soferului.',
      error: 'Verifica semnalul GPS si incearca din nou.'
    }[this.locationState];
  }

  get locationReadyHint(): string {
    if (!this.currentPosition) {
      return 'Pontajul este blocat pana cand pozitia curenta este disponibila.';
    }

    return `Pozitie curenta: ${this.formatCoordinates(this.currentPosition.lat, this.currentPosition.lng)}. Acuratete aproximativa: ${Math.round(this.currentPosition.accuracy)} m.`;
  }

  updatePin(value: string): void {
    this.pin = value.replace(/\D/g, '').slice(0, 12);
  }

  clearPin(): void {
    this.pin = '';
  }

  refreshLocation(): void {
    this.hasCenteredOnUser = false;
    this.startGeolocation();
  }

  submitPin(): void {
    if (!this.currentPosition || this.locationState !== 'ready') {
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

  private startGeolocation(): void {
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

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePosition(position),
      (error) => this.handlePositionError(error),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 3000
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

    if (!this.hasCenteredOnUser) {
      this.map.setView(latLng, 16, { animate: false });
      this.hasCenteredOnUser = true;
    }
  }
}
