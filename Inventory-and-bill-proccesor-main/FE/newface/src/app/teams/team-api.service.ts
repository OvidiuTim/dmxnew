import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TeamEmployee {
  id: number;
  name: string;
  serie: string;
  company: string;
  trade: string;
  email?: string;
  photo?: string | null;
  active: boolean;
  team?: { id: number; name: string } | null;
  category?: 'leader' | 'permanent' | 'received' | 'sent' | 'available';
  presence?: 'present' | 'absent' | 'leave';
  today_leave?: { reason: string; label: string } | null;
  leave_balance?: { remaining_days: string; total_used_days: number; total_accrued_days: string } | null;
  leave?: { reason: string; label: string } | null;
  worksite?: string;
  temporary_team?: { id: number; name: string } | null;
  is_team_leader?: boolean;
  can_take_in_my_team?: boolean;
  target_team_id?: number | null;
  can_request?: boolean;
  can_request_permanent?: boolean;
  ssm_complete?: boolean;
  active_requests?: TeamRequest[];
}

export interface EmployeeTeam {
  id: number;
  name: string;
  active: boolean;
  default_worksite: string;
  leader: TeamEmployee;
  supervisor: TeamEmployee;
  members: TeamEmployee[];
  member_ids: number[];
  can_edit: boolean;
  can_manage_settings: boolean;
  can_delete?: boolean;
  can_update_leader_email?: boolean;
}

export interface TeamRequest {
  id: number;
  employee: TeamEmployee;
  source_team: { id: number; name: string };
  requester_team: { id: number; name: string };
  start_date: string;
  end_date: string;
  reason: string;
  requested_by: { id: number | null; name: string };
  resolved_by: { id: number | null; name: string } | null;
  request_type: 'temporary' | 'permanent';
  request_type_label: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  status_label: string;
  can_approve: boolean;
  can_reject: boolean;
  can_cancel: boolean;
  is_unseen: boolean;
  email_sent: boolean;
}

export interface LeaveNotification {
  id: number;
  employee: { id: number; name: string; serie: string; trade: string };
  team: { id: number; name: string } | null;
  leave_type: string;
  leave_type_label: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  status_label: string;
  created_at: string | null;
  is_unseen: boolean;
}

@Injectable({ providedIn: 'root' })
export class TeamApiService {
  private readonly API = (typeof window !== 'undefined' ? window.location.origin : '') + '/api/teams';
  private readonly PONTAJ_API = (typeof window !== 'undefined' ? window.location.origin : '') + '/api/pontaj';

  constructor(private http: HttpClient) {}

  getTeams(): Observable<any> {
    return this.http.get(`${this.API}/`);
  }

  getWorksites(): Observable<{ worksites: string[] }> {
    return this.http.get<{ worksites: string[] }>(`${this.PONTAJ_API}/worksites/`);
  }

  createTeam(payload: any): Observable<any> {
    return this.http.post(`${this.API}/`, payload);
  }

  updateTeam(teamId: number, payload: any): Observable<any> {
    return this.http.put(`${this.API}/${teamId}/`, payload);
  }

  deleteTeam(teamId: number): Observable<any> {
    return this.http.delete(`${this.API}/${teamId}/`);
  }

  updateMember(teamId: number, employeeId: number, action: 'add' | 'remove'): Observable<any> {
    return this.http.post(`${this.API}/${teamId}/members/`, { employee_id: employeeId, action });
  }

  getRequests(): Observable<any> {
    return this.http.get(`${this.API}/requests/`);
  }

  getNotifications(): Observable<any> {
    return this.http.get(`${this.API}/notifications/`);
  }

  getNotificationSummary(): Observable<any> {
    return this.http.get(`${this.API}/notifications/summary/`);
  }

  createRequest(payload: any): Observable<any> {
    return this.http.post(`${this.API}/requests/`, payload);
  }

  actOnRequest(requestId: number, action: 'approve' | 'reject' | 'cancel'): Observable<any> {
    return this.http.post(`${this.API}/requests/${requestId}/action/`, { action });
  }

  getToday(date: string): Observable<any> {
    return this.http.get(`${this.API}/today/`, { params: { date } });
  }

  getAvailable(date: string): Observable<any> {
    return this.http.get(`${this.API}/available/`, { params: { date } });
  }
}
