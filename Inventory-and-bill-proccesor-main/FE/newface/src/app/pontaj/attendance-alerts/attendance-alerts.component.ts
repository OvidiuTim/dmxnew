import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SharedService } from '../../shared.service';

@Component({
  selector: 'app-attendance-alerts',
  templateUrl: './attendance-alerts.component.html',
  styleUrls: ['./attendance-alerts.component.css'],
})
export class AttendanceAlertsComponent implements OnInit {
  data: any = null;
  configs: any[] = [];
  // Pagina afișează întotdeauna ziua curentă: supraveghetorii sunt aceiași în fiecare zi.
  private get selectedDate(): string { return this.todayISO(); }
  loading = false;
  saving = false;
  error = '';
  notice = '';

  constructor(private api: SharedService, private router: Router) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getAttendanceAlerts(this.selectedDate).subscribe({
      next: data => {
        this.data = data;
        this.configs = (data.configs || []).map((item: any) => ({ ...item }));
        this.loading = false;
      },
      error: err => {
        this.error = err?.error?.error || 'Alertele nu au putut fi încărcate.';
        this.loading = false;
      },
    });
  }

  save(): void {
    this.saving = true;
    this.error = '';
    this.notice = '';
    this.api.updateAttendanceAlertConfigs(this.configs, this.selectedDate).subscribe({
      next: data => {
        this.data = data;
        this.configs = (data.configs || []).map((item: any) => ({ ...item }));
        this.notice = 'Configurația alertelor a fost salvată.';
        this.saving = false;
      },
      error: err => {
        this.error = err?.error?.error || 'Configurația nu a putut fi salvată.';
        this.saving = false;
      },
    });
  }

  onRecipientChange(config: any): void {
    const selected = (this.data?.app_users || []).find((user: any) => Number(user.id) === Number(config.app_user_id));
    if (selected) config.email = selected.email || '';
  }

  levelLabel(level: number): string {
    return level === 0 ? '07:40 · Inițială' : level === 1 ? 'Nivel 1' : 'Nivel 2';
  }

  goBack(): void { this.router.navigate(['/pontaj']); }

  private todayISO(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
