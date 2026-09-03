import { Component, OnInit } from '@angular/core';
import { SharedService } from '../../shared.service';

type LeaveStatus = 'pending' | 'approved' | 'rejected';
type LeaveAction = 'approve' | 'reject';

type LeaveRequest = {
  id: number;
  employee: { id: number; name: string; serie: string; company: string; trade: string; photo: string | null };
  team: { id: number; name: string } | null;
  assigned_leader: { id: number; name: string } | null;
  leave_type: string;
  leave_type_label: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_days: number;
  status: LeaveStatus;
  status_label: string;
  created_at: string | null;
  reviewed_at: string | null;
  reviewed_by: { name: string } | null;
  can_decide: boolean;
};

type IndiaTicketEmployee = {
  employee_id: number;
  name: string;
  series: string;
  company: string;
  trade: string;
  hire_date: string;
  seniority_months: number;
  seniority: string;
  already_used: boolean;
  last_home_trip_date: string | null;
  next_eligibility_date: string;
  situation: string;
};

@Component({
  selector: 'app-leave-requests',
  templateUrl: './leave-requests.component.html',
  styleUrls: ['./leave-requests.component.css'],
})
export class LeaveRequestsComponent implements OnInit {
  requests: LeaveRequest[] = [];
  searchTerm = '';
  statusFilter: 'all' | LeaveStatus = 'all';
  loading = false;
  error = '';
  notice = '';
  canManageAll = false;
  indiaReportOpen = false;
  indiaReportLoading = false;
  indiaReportExporting = false;
  indiaReportSearched = false;
  indiaReportError = '';
  indiaReportRows: IndiaTicketEmployee[] = [];
  indiaReportForm = { start_date: '', end_date: '' };
  private busyIds = new Set<number>();

  constructor(private api: SharedService) {}

  ngOnInit(): void {
    this.load();
  }

  get filteredRequests(): LeaveRequest[] {
    const search = this.normalize(this.searchTerm);
    return this.requests.filter(item => {
      const statusMatches = this.statusFilter === 'all' || item.status === this.statusFilter;
      const searchMatches = !search || this.normalize([
        item.employee.name,
        item.employee.serie,
        item.employee.trade,
        item.employee.company,
        item.team?.name || '',
        item.leave_type_label,
        item.reason,
      ].join(' ')).includes(search);
      return statusMatches && searchMatches;
    });
  }

  count(status?: LeaveStatus): number {
    return status ? this.requests.filter(item => item.status === status).length : this.requests.length;
  }

  statusLabel(status: LeaveStatus): string {
    return { pending: 'În așteptare', approved: 'Aprobată', rejected: 'Respinsă' }[status];
  }

  isBusy(id: number): boolean {
    return this.busyIds.has(id);
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getLeaveRequests().subscribe({
      next: response => {
        this.requests = response.leave_requests || [];
        this.canManageAll = !!response.permissions?.can_manage_all;
        this.loading = false;
        window.dispatchEvent(new CustomEvent('team-notifications-changed'));
      },
      error: error => {
        this.loading = false;
        this.error = error?.error?.error || 'Cererile de concediu nu au putut fi încărcate.';
      },
    });
  }

  decide(item: LeaveRequest, action: LeaveAction): void {
    if (!item.can_decide || this.isBusy(item.id)) return;
    const verb = action === 'approve' ? 'aprobi' : 'respingi';
    if (!window.confirm(`Sigur vrei să ${verb} cererea lui ${item.employee.name}?`)) return;

    this.busyIds.add(item.id);
    this.error = '';
    this.notice = '';
    this.api.decideLeaveRequest(item.id, action).subscribe({
      next: response => {
        const index = this.requests.findIndex(request => request.id === item.id);
        if (index >= 0) this.requests[index] = response.leave_request;
        this.busyIds.delete(item.id);
        this.notice = action === 'approve' ? 'Cererea a fost aprobată.' : 'Cererea a fost respinsă.';
        window.dispatchEvent(new CustomEvent('team-notifications-changed'));
      },
      error: error => {
        this.busyIds.delete(item.id);
        this.error = this.errorMessage(error);
      },
    });
  }

  openIndiaTicketReport(): void {
    if (!this.canManageAll) return;
    const today = new Date();
    const periodEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    this.indiaReportForm = {
      start_date: this.localIsoDate(today),
      end_date: this.localIsoDate(periodEnd),
    };
    this.indiaReportRows = [];
    this.indiaReportError = '';
    this.indiaReportSearched = false;
    this.indiaReportOpen = true;
  }

  closeIndiaTicketReport(): void {
    if (!this.indiaReportLoading && !this.indiaReportExporting) this.indiaReportOpen = false;
  }

  searchIndiaTicketReport(): void {
    const { start_date, end_date } = this.indiaReportForm;
    if (!start_date || !end_date) {
      this.indiaReportError = 'Selectează data de început și data de sfârșit.';
      return;
    }
    if (end_date < start_date) {
      this.indiaReportError = 'Data de sfârșit nu poate fi înaintea datei de început.';
      return;
    }
    this.indiaReportLoading = true;
    this.indiaReportSearched = false;
    this.indiaReportError = '';
    this.api.getIndiaTicketEligibilityReport(start_date, end_date).subscribe({
      next: response => {
        this.indiaReportRows = response?.employees || [];
        this.indiaReportLoading = false;
        this.indiaReportSearched = true;
      },
      error: error => {
        this.indiaReportRows = [];
        this.indiaReportLoading = false;
        this.indiaReportSearched = true;
        this.indiaReportError = error?.error?.error || 'Raportul nu a putut fi generat.';
      },
    });
  }

  exportIndiaTicketReport(): void {
    if (!this.indiaReportSearched || !this.indiaReportRows.length) return;
    const { start_date, end_date } = this.indiaReportForm;
    this.indiaReportExporting = true;
    this.indiaReportError = '';
    this.api.exportIndiaTicketEligibilityReport(start_date, end_date).subscribe({
      next: response => {
        this.indiaReportExporting = false;
        this.downloadResponse(response, `eligibili_bilet_india_${this.fileDate(start_date)}_${this.fileDate(end_date)}.xlsx`);
      },
      error: () => {
        this.indiaReportExporting = false;
        this.indiaReportError = 'Fișierul Excel nu a putut fi generat.';
      },
    });
  }

  trackById(_: number, item: LeaveRequest): number {
    return item.id;
  }

  private errorMessage(error: any): string {
    const details = error?.error?.details;
    const detail = details ? Object.values(details).flat().join(' ') : '';
    return detail || error?.error?.error || 'Cererea nu a putut fi soluționată.';
  }

  private downloadResponse(response: any, fallbackName: string): void {
    const blob = response?.body as Blob | null;
    if (!blob) return;
    const disposition = String(response?.headers?.get('content-disposition') || '');
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = match?.[1] || fallbackName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private localIsoDate(value: Date): string {
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  }

  private fileDate(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}-${month}-${year}`;
  }

  private normalize(value: string): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
}
