import { readEmployeeLanguage } from '../i18n/employee-language';
import { employeeCopy } from '../i18n/employee-copy';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as L from 'leaflet';

interface Worksite { name: string; latitude: number; longitude: number; radius_meters: number; }
interface PresenceSession {
  work_date: string; worksite: string; in_time: string; out_time: string; hours: number;
  distance_m?: number | null; inside_perimeter?: boolean | null;
}
interface PresenceStatus {
  employee: { name: string }; work_date: string; worksites: Worksite[];
  session: PresenceSession | null; can_confirm: boolean; blocked_reason: string | null; blocked_reason_code?: string | null;
}

@Component({
  selector: 'app-tesa-presence',
  templateUrl: './tesa-presence.component.html',
  styleUrls: ['./tesa-presence.component.css'],
})
export class TesaPresenceComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly language = readEmployeeLanguage();
  readonly t = employeeCopy[this.language];
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
  position: { lat: number; lng: number; accuracy: number; captured_at: string } | null = null;

  // Harta este identică ca rol cu cea din pontajul obișnuit: zona șantierului,
  // poziția proprie și distanța. Diferența e că personalul TESA poate confirma
  // și din afara perimetrului, deci harta informează, nu blochează.
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
        if (status.session) this.worksite = status.session.worksite;
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
    if (!this.status?.can_confirm || this.saving || this.locating || !this.worksite) return;
    // Always request a fresh GPS fix at confirmation, even after a preview.
    this.readLocation(true);
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
      if (submit) this.save();
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
    this.http.post<{ session: PresenceSession }>(this.api, { worksite: this.worksite, gps: this.position },
      { withCredentials: true }).pipe(takeUntil(this.destroyed$)).subscribe({
      next: result => {
        this.saving = false;
        if (this.status) this.status = { ...this.status, session: result.session, can_confirm: false, blocked_reason: null };
      },
      error: err => {
        this.saving = false;
        this.error = this.language === 'ro' ? (err.error?.error || this.t.error) : this.t.error;
        if (err.status === 403) void this.router.navigateByUrl('/team-dashboard');
      },
    });
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
