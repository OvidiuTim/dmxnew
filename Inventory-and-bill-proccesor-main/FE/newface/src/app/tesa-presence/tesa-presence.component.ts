import { readEmployeeLanguage } from '../i18n/employee-language';
import { employeeCopy } from '../i18n/employee-copy';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as L from 'leaflet';

interface Worksite { name: string; latitude: number; longitude: number; radius_meters: number; }
interface CapturedPosition { lat: number; lng: number; accuracy: number; captured_at: string; }
interface PresenceSession {
  work_date: string; worksite: string | null; in_time: string; out_time: string | null; hours: number; state: 'open' | 'closed';
  distance_m?: number | null; inside_perimeter?: boolean | null;
  checkout_distance_m?: number | null; checkout_inside_perimeter?: boolean | null;
}
interface PresenceStatus {
  employee: { name: string; is_tesa?: boolean; is_driver?: boolean }; work_date: string; worksites: Worksite[];
  unrestricted_location?: boolean;
  outside_perimeter_allowed?: boolean;
  session: PresenceSession | null; state: 'not_checked_in' | 'checked_in' | 'checked_out';
  can_check_in: boolean; can_check_out: boolean; can_confirm: boolean;
  blocked_reason: string | null; blocked_reason_code?: string | null;
}

interface AttendanceSuccessNotice {
  message: string;
  redirecting: string;
}

@Component({
  selector: 'app-tesa-presence',
  templateUrl: './tesa-presence.component.html',
  styleUrls: ['./tesa-presence.component.css'],
})
export class TesaPresenceComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly language = readEmployeeLanguage();
  readonly t = employeeCopy[this.language];
  readonly defaultWorksite = 'Birou ingineri & TESA';
  get blockedReason(): string {
    if (this.status?.blocked_reason_code === 'ATTENDANCE_CONFLICT') return this.t.attendanceConflict;
    if (this.status?.blocked_reason_code === 'LEAVE_CONFLICT') return this.t.leaveConflict;
    return this.language === 'ro' ? (this.status?.blocked_reason || '') : this.t.error;
  }

  private readonly api = `${window.location.origin}/api/team-portal/tesa-presence/`;
  private readonly destroyed$ = new Subject<void>();
  private destroyed = false;
  status: PresenceStatus | null = null;
  loading = true;
  locating = false;
  saving = false;
  worksite = '';
  error = '';
  position: CapturedPosition | null = null;
  successNotice: AttendanceSuccessNotice | null = null;
  private dashboardRedirectTimer: ReturnType<typeof setTimeout> | null = null;

  // Reguli: TESA = punct de lucru + poziție în raza lui (harta arată cercul).
  // TESA + pontaj mobil permis = de oriunde, fără hartă; punctul de lucru rămâne
  // selectabil, implicit „Birou ingineri & TESA”. GPS-ul se salvează mereu.
  @ViewChild('mapEl') set mapElement(element: ElementRef<HTMLElement> | undefined) {
    if (element && !this.map) {
      this.initMap(element.nativeElement);
    } else if (!element && this.map) {
      this.map.remove();
      this.map = null;
      this.zoneShape = this.zoneCenter = this.userMarker = this.accuracyCircle = null;
    }
  }
  private map: L.Map | null = null;
  private zoneShape: L.Circle | null = null;
  private zoneCenter: L.CircleMarker | null = null;
  private userMarker: L.CircleMarker | null = null;
  private accuracyCircle: L.Circle | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void { this.load(); }
  ngAfterViewInit(): void { setTimeout(() => this.map?.invalidateSize(), 0); }
  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.dashboardRedirectTimer) clearTimeout(this.dashboardRedirectTimer);
    this.destroyed$.next();
    this.destroyed$.complete();
    this.map?.remove();
    this.map = null;
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.http.get<PresenceStatus>(this.api, { withCredentials: true }).pipe(takeUntil(this.destroyed$)).subscribe({
      next: status => {
        this.status = status;
        this.loading = false;
        if (status.session?.worksite) {
          this.worksite = status.session.worksite;
        } else if (!this.worksite && status.worksites.some(site => site.name === this.defaultWorksite)) {
          this.worksite = this.defaultWorksite;
        }
        setTimeout(() => this.drawWorksite(), 0);
      },
      error: err => {
        this.loading = false;
        if (err.status === 403 || err.status === 401) {
          void this.router.navigateByUrl('/team-dashboard');
        } else this.error = this.t.loadError;
      },
    });
  }

  get selectedSite(): Worksite | undefined { return this.status?.worksites.find(site => site.name === this.worksite); }
  get unrestrictedLocation(): boolean {
    return this.status?.outside_perimeter_allowed === true
      || this.status?.unrestricted_location === true
      || (this.status?.employee?.is_tesa === true && this.status?.employee?.is_driver === true);
  }
  get unrestrictedHint(): string {
    return {
      ro: 'Verifică punctul de lucru și apasă butonul de mai jos.',
      en: 'Check the work point and tap the button below.',
      pa: 'ਕੰਮ ਦੀ ਥਾਂ ਜਾਂਚੋ ਅਤੇ ਹੇਠਾਂ ਦਿੱਤਾ ਬਟਨ ਦਬਾਓ।',
      hi: 'कार्य स्थल जाँचें और नीचे दिया बटन दबाएँ।',
      ne: 'कार्यस्थल जाँच गर्नुहोस् र तलको बटन थिच्नुहोस्।',
    }[this.language];
  }
  get workPointLabel(): string {
    return {
      ro: 'Selectează punctul de lucru',
      en: 'Select work location',
      pa: 'ਕੰਮ ਦੀ ਥਾਂ ਚੁਣੋ',
      hi: 'कार्य स्थल चुनें',
      ne: 'कार्यस्थल छान्नुहोस्',
    }[this.language];
  }
  /** Sesiunea de azi e închisă, dar se poate începe una nouă (depontare din greșeală,
   * ieșire și revenire în aceeași zi). */
  get completedToday(): boolean {
    return !!this.status?.session?.out_time && this.status?.can_check_in === true;
  }
  get closedSession(): PresenceSession | null {
    return this.completedToday ? this.status?.session ?? null : null;
  }
  get resumeHint(): string {
    return {
      ro: 'Pontajul a fost salvat. Pentru o intrare nouă, apasă butonul de mai jos.',
      en: 'Your attendance was saved. To start a new entry, tap the button below.',
      pa: 'ਹਾਜ਼ਰੀ ਸੰਭਾਲੀ ਗਈ ਹੈ। ਨਵੀਂ ਹਾਜ਼ਰੀ ਲਈ ਹੇਠਾਂ ਦਿੱਤਾ ਬਟਨ ਦਬਾਓ।',
      hi: 'उपस्थिति सहेज ली गई है। नई प्रविष्टि के लिए नीचे दिया बटन दबाएँ।',
      ne: 'हाजिरी सुरक्षित भयो। नयाँ प्रविष्टिका लागि तलको बटन थिच्नुहोस्।',
    }[this.language];
  }
  get perimeterRequiredHint(): string {
    return {
      ro: 'Mergi în zona punctului de lucru selectat și încearcă din nou.',
      en: 'Go to the selected work point area and try again.',
      pa: 'ਚੁਣੀ ਕੰਮ ਦੀ ਥਾਂ ਦੇ ਖੇਤਰ ਵਿੱਚ ਜਾਓ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
      hi: 'चुने गए कार्य स्थल के क्षेत्र में जाएँ और फिर से प्रयास करें।',
      ne: 'छानिएको कार्यस्थलको क्षेत्रमा जानुहोस् र फेरि प्रयास गर्नुहोस्।',
    }[this.language];
  }
  get distanceMeters(): number | null {
    const site = this.selectedSite;
    if (!site || !this.position) return null;
    return this.metersBetween(this.position.lat, this.position.lng, site.latitude, site.longitude);
  }
  get insidePerimeter(): boolean | null {
    const site = this.selectedSite;
    const distance = this.distanceMeters;
    return site && distance !== null ? distance <= site.radius_meters : null;
  }

  private metersBetween(latA: number, lngA: number, latB: number, lngB: number): number {
    const rad = (value: number) => value * Math.PI / 180;
    const dLat = rad(latB - latA);
    const dLng = rad(lngB - lngA);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  worksiteChanged(): void {
    this.position = null;
    this.error = '';
    this.drawWorksite();
    // Alegerea șantierului cere automat locația, ca harta să arate imediat
    // unde ești față de perimetru.
    if (this.worksite) this.readLocation(false);
  }

  locate(): void { this.readLocation(false); }

  confirm(): void {
    if (!this.canConfirm || this.saving || this.locating) return;
    // La ambele acțiuni se cere o poziție proaspătă. Nu se cere fotografie.
    this.readLocation(true);
  }

  get action(): 'check_in' | 'check_out' {
    return this.status?.session && !this.status.session.out_time ? 'check_out' : 'check_in';
  }

  get canSubmit(): boolean {
    return this.action === 'check_out' ? !!this.status?.can_check_out : !!this.status?.can_check_in;
  }

  get canConfirm(): boolean {
    return this.canSubmit && !!this.worksite && (this.unrestrictedLocation || this.insidePerimeter !== false);
  }

  private readLocation(submit: boolean): void {
    if (this.locating || this.saving || !this.worksite) return;
    this.error = '';
    this.position = null;
    this.drawPosition();
    if (!navigator.geolocation) {
      this.error = this.t.locationUnsupported;
      return;
    }
    this.locating = true;
    navigator.geolocation.getCurrentPosition(position => {
      if (this.destroyed) return;
      this.locating = false;
      this.position = {
        lat: position.coords.latitude, lng: position.coords.longitude,
        accuracy: position.coords.accuracy, captured_at: new Date(position.timestamp).toISOString(),
      };
      this.drawPosition();
      if (submit) {
        if (this.canConfirm) this.save();
        else if (!this.unrestrictedLocation && this.insidePerimeter === false) this.error = this.perimeterRequiredHint;
      }
    }, error => {
      if (this.destroyed) return;
      this.locating = false;
      this.error = error.code === 1
        ? this.t.locationDenied
        : this.t.locationError;
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }

  private save(): void {
    this.saving = true;
    const action = this.action;
    const payload: { action: 'check_in' | 'check_out'; gps: CapturedPosition | null; worksite: string } = {
      action,
      gps: this.position,
      worksite: this.worksite,
    };
    this.http.post<{ session: PresenceSession }>(this.api, payload,
      { withCredentials: true }).pipe(takeUntil(this.destroyed$)).subscribe({
      next: result => {
        this.saving = false;
        if (this.status) this.status = {
          ...this.status,
          session: result.session,
          state: result.session.out_time ? 'checked_out' : 'checked_in',
          can_check_in: !!result.session.out_time,
          can_check_out: !result.session.out_time,
          can_confirm: true,
          blocked_reason: null,
        };
        this.position = null;
        this.successNotice = this.attendanceSuccessNotice(action, result.session);
        this.dashboardRedirectTimer = setTimeout(() => {
          void this.router.navigateByUrl('/team-dashboard');
        }, 1800);
      },
      error: err => {
        this.saving = false;
        this.error = this.language === 'ro' ? (err.error?.error || this.t.error) : this.t.error;
        if (err.status === 403) void this.router.navigateByUrl('/team-dashboard');
      },
    });
  }

  private attendanceSuccessNotice(
    action: 'check_in' | 'check_out',
    session: PresenceSession,
  ): AttendanceSuccessNotice {
    const timestamp = action === 'check_in' ? session.in_time : session.out_time;
    const parsed = timestamp ? new Date(timestamp) : new Date();
    const locale = { ro: 'ro-RO', en: 'en-GB', pa: 'pa-IN', hi: 'hi-IN', ne: 'ne-NP' }[this.language];
    const time = new Intl.DateTimeFormat(locale, {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest',
    }).format(parsed);
    const messages = {
      ro: action === 'check_in' ? `Te-ai pontat la ${time}.` : `Te-ai depontat la ${time}.`,
      en: action === 'check_in' ? `You clocked in at ${time}.` : `You clocked out at ${time}.`,
      pa: action === 'check_in' ? `ਤੁਸੀਂ ${time} ਵਜੇ ਚੈੱਕ-ਇਨ ਕੀਤਾ।` : `ਤੁਸੀਂ ${time} ਵਜੇ ਚੈੱਕ-ਆਉਟ ਕੀਤਾ।`,
      hi: action === 'check_in' ? `आपने ${time} बजे चेक-इन किया।` : `आपने ${time} बजे चेक-आउट किया।`,
      ne: action === 'check_in' ? `तपाईंले ${time} मा चेक-इन गर्नुभयो।` : `तपाईंले ${time} मा चेक-आउट गर्नुभयो।`,
    };
    const redirecting = {
      ro: 'Te întoarcem la dashboard…',
      en: 'Returning to the dashboard…',
      pa: 'ਡੈਸ਼ਬੋਰਡ ਤੇ ਵਾਪਸ ਜਾ ਰਹੇ ਹਾਂ…',
      hi: 'डैशबोर्ड पर वापस जा रहे हैं…',
      ne: 'ड्यासबोर्डमा फर्किँदै…',
    };
    return { message: messages[this.language], redirecting: redirecting[this.language] };
  }

  private initMap(container: HTMLElement): void {
    try {
      this.map = L.map(container, { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(this.map);
      this.map.setView([45.7983, 24.1256], 7);
      setTimeout(() => this.map?.invalidateSize(), 0);
      this.drawWorksite();
    } catch {
      this.map = null;
    }
  }

  private drawWorksite(): void {
    if (!this.map) return;
    for (const layer of [this.zoneShape, this.zoneCenter]) if (layer) this.map.removeLayer(layer);
    this.zoneShape = this.zoneCenter = null;
    const site = this.selectedSite;
    if (!site) {
      this.map.setView([45.7983, 24.1256], 7);
      return;
    }
    this.zoneShape = L.circle([site.latitude, site.longitude], {
      radius: site.radius_meters, color: '#0f766e', weight: 2, fillColor: '#0f766e', fillOpacity: 0.14,
    }).addTo(this.map);
    this.zoneCenter = L.circleMarker([site.latitude, site.longitude], {
      radius: 7, color: '#0f766e', weight: 2, fillColor: '#f8fafc', fillOpacity: 1,
    }).addTo(this.map);
    this.map.setView([site.latitude, site.longitude], 17, { animate: false });
    setTimeout(() => this.map?.invalidateSize(), 0);
    this.drawPosition();
  }

  private drawPosition(): void {
    if (!this.map) return;
    if (!this.position || !this.selectedSite) {
      for (const layer of [this.userMarker, this.accuracyCircle]) if (layer) this.map.removeLayer(layer);
      this.userMarker = this.accuracyCircle = null;
      return;
    }
    const color = this.insidePerimeter ? '#0f766e' : '#d97706';
    const latLng = L.latLng(this.position.lat, this.position.lng);
    if (!this.userMarker) {
      this.userMarker = L.circleMarker(latLng, { radius: 9, color, weight: 3, fillColor: color, fillOpacity: 0.95 }).addTo(this.map);
    } else {
      this.userMarker.setLatLng(latLng).setStyle({ color, fillColor: color });
    }
    if (!this.accuracyCircle) {
      this.accuracyCircle = L.circle(latLng, { radius: this.position.accuracy, color, weight: 1, fillColor: color, fillOpacity: 0.08 }).addTo(this.map);
    } else {
      this.accuracyCircle.setLatLng(latLng).setRadius(this.position.accuracy).setStyle({ color, fillColor: color });
    }
    // Încadrează șantierul și poziția, ca distanța să fie vizibilă și când ești departe.
    const site = this.selectedSite;
    const bounds = L.latLngBounds([latLng, L.latLng(site.latitude, site.longitude)]).pad(0.35);
    this.map.fitBounds(bounds, { maxZoom: 17, animate: false });
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  back(): void { void this.router.navigateByUrl('/team-dashboard'); }
}
