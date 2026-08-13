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

  trackById(_: number, item: LeaveRequest): number {
    return item.id;
  }

  private errorMessage(error: any): string {
    const details = error?.error?.details;
    const detail = details ? Object.values(details).flat().join(' ') : '';
    return detail || error?.error?.error || 'Cererea nu a putut fi soluționată.';
  }

  private normalize(value: string): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
}
