import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SharedService } from '../shared.service';
import { readEmployeeLanguage } from '../i18n/employee-language';
import { employeeCopy } from '../i18n/employee-copy';

@Component({
  selector: 'app-fleet',
  templateUrl: './fleet.component.html',
  styleUrls: ['./fleet.component.css']
})
export class FleetComponent implements OnInit {
  readonly language = readEmployeeLanguage();
  readonly ui = employeeCopy[this.language];
  readonly locale = { ro: 'ro-RO', en: 'en-GB', pa: 'pa-IN', hi: 'hi-IN', ne: 'ne-NP', bn: 'bn-BD' }[this.language];

  token = '';
  query = '';
  pin = '';
  counter: number | null = null;
  equipment: any = null;
  equipmentList: any[] = [];
  scannerOpen = false;
  loading = false;
  submitting = false;
  error = '';
  success = '';

  constructor(private route: ActivatedRoute, private router: Router, private api: SharedService) {}

  ngOnInit(): void {
    this.token = String(this.route.snapshot.paramMap.get('token') || '');
    if (this.token) this.loadEquipment(this.token);
  }

  loadList(): void {
    this.loading = true;
    this.api.getFleetEquipment().subscribe({
      next: response => { this.equipmentList = response?.equipment || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  search(): void {
    if (!this.query.trim()) return;
    this.loading = true;
    this.error = '';
    this.api.lookupFleetEquipment(this.query.trim()).subscribe({
      next: response => {
        this.loading = false;
        const item = response?.equipment;
        if (item?.token) this.navigateToEquipment(item.token);
      },
      error: error => { this.loading = false; this.error = this.apiError(error); }
    });
  }

  open(item: any): void {
    this.navigateToEquipment(item.token);
  }

  scanSuccess(value: string): void {
    const scanned = String(value || '').trim();
    if (!scanned) return;
    this.scannerOpen = false;
    const token = scanned.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
    if (token) {
      this.navigateToEquipment(token);
      return;
    }
    this.query = scanned;
    this.search();
  }

  back(): void {
    if (this.token) {
      void this.router.navigateByUrl(this.isTeamDashboard ? '/team-dashboard/utilaje' : '/team-dashboard');
    } else {
      void this.router.navigateByUrl('/team-dashboard');
    }
  }

  get isTeamDashboard(): boolean {
    return this.router.url.startsWith('/team-dashboard/');
  }

  take(): void { this.submitAction('take'); }
  giveBack(): void { this.submitAction('return'); }

  documentLabel(document: any): string {
    if (document.status === 'missing') return this.ui.fleetDocumentMissing;
    if (document.status === 'expired') return this.ui.fleetDocumentExpired;
    if (!document.expiry_date) return this.ui.fleetDocumentValid;
    const date = new Intl.DateTimeFormat(this.locale).format(new Date(`${document.expiry_date}T12:00:00`));
    return document.status === 'warning'
      ? `${this.ui.fleetExpiresSoon} ${date}`
      : `${this.ui.fleetValidUntil} ${date}`;
  }

  private loadEquipment(token: string): void {
    this.loading = true;
    this.error = '';
    this.api.getFleetEquipmentByToken(token).subscribe({
      next: response => { this.equipment = response?.equipment; this.loading = false; },
      error: error => { this.loading = false; this.error = this.apiError(error); }
    });
  }

  private navigateToEquipment(token: string): void {
    void this.router.navigate([this.isTeamDashboard ? '/team-dashboard/utilaje' : '/pontaj/utilaj', token]);
  }

  private submitAction(action: 'take' | 'return'): void {
    if (!this.equipment || this.submitting) return;
    this.submitting = true;
    this.error = '';
    this.success = '';
    const send = (gps?: GeolocationPosition) => {
      const payload = {
        pin: this.pin.trim(),
        counter: this.counter,
        gps: gps ? { lat: gps.coords.latitude, lng: gps.coords.longitude, accuracy: gps.coords.accuracy } : undefined
      };
      const request = action === 'take'
        ? this.api.takeFleetEquipment(this.equipment.token, payload)
        : this.api.returnFleetEquipment(this.equipment.token, payload);
      request.subscribe({
        next: response => {
          this.submitting = false;
          this.equipment = response?.equipment;
          this.pin = '';
          this.counter = null;
          this.success = action === 'take' ? this.ui.fleetTakenSuccess : this.ui.fleetReturnedSuccess;
        },
        error: error => { this.submitting = false; this.error = this.apiError(error); }
      });
    };
    if (action === 'take' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(send, () => send(), { enableHighAccuracy: true, timeout: 8000 });
    } else send();
  }

  private apiError(error: any): string {
    return String(error?.error?.error || this.ui.error);
  }
}
