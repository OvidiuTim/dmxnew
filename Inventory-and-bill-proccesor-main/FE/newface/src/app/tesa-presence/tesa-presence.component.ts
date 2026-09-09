import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Worksite { name: string; latitude: number; longitude: number; radius_meters: number; }
interface PresenceSession { work_date: string; worksite: string; in_time: string; out_time: string; hours: number; }
interface PresenceStatus {
  employee: { name: string }; work_date: string; worksites: Worksite[];
  session: PresenceSession | null; can_confirm: boolean; blocked_reason: string | null;
}

@Component({
  selector: 'app-tesa-presence',
  templateUrl: './tesa-presence.component.html',
  styleUrls: ['./tesa-presence.component.css'],
})
export class TesaPresenceComponent implements OnInit, OnDestroy {
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

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.http.get<PresenceStatus>(this.api, { withCredentials: true }).pipe(takeUntil(this.destroyed$)).subscribe({
      next: status => {
        this.status = status;
        this.loading = false;
        if (status.session) this.worksite = status.session.worksite;
      },
      error: err => {
        this.loading = false;
        if (err.status === 403 || err.status === 401) {
          void this.router.navigateByUrl('/team-dashboard');
        } else this.error = 'Nu am putut încărca prezența. Încearcă din nou.';
      },
    });
  }

  get selectedSite(): Worksite | undefined { return this.status?.worksites.find(site => site.name === this.worksite); }
  get distanceMeters(): number | null {
    const site = this.selectedSite;
    if (!site || !this.position) return null;
    const rad = (value: number) => value * Math.PI / 180;
    const dLat = rad(site.latitude - this.position.lat);
    const dLng = rad(site.longitude - this.position.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(this.position.lat)) * Math.cos(rad(site.latitude)) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  worksiteChanged(): void { this.position = null; this.error = ''; }

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
    if (!navigator.geolocation) {
      this.error = 'Acest browser nu oferă acces la locație.';
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
      if (submit) this.save();
    }, error => {
      if (this.destroyed) return;
      this.locating = false;
      this.error = error.code === 1
        ? 'Accesul la locație a fost refuzat. Permite locația în browser și încearcă din nou.'
        : 'Nu am putut obține locația. Activează GPS-ul și încearcă din nou.';
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
        this.error = err.error?.error || 'Confirmarea nu a putut fi salvată. Încearcă din nou.';
        if (err.status === 403 && !this.error.includes('perimetr')) {
          void this.router.navigateByUrl('/team-dashboard');
        }
      },
    });
  }

  back(): void { void this.router.navigateByUrl('/team-dashboard'); }
}
