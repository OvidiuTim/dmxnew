import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TeamEmployee {
  id: number;
  name: string;
  serie: string;
  company: string;
  trade: string;
  active: boolean;
  team?: { id: number; name: string } | null;
  category?: 'leader' | 'permanent' | 'received' | 'sent' | 'available';
  presence?: 'present' | 'absent' | 'leave';
  leave?: { reason: string; label: string } | null;
  worksite?: string;
  temporary_team?: { id: number; name: string } | null;
  is_team_leader?: boolean;
  can_add_permanent?: boolean;
  can_request?: boolean;
}

export interface EmployeeTeam {
  id: number;
  name: string;
  active: boolean;
  default_worksite: string;
  leader: TeamEmployee;
  members: TeamEmployee[];
  member_ids: number[];
  can_edit: boolean;
  can_manage_settings: boolean;
}

export interface TeamRequest {
  id: number;
  employee: TeamEmployee;
  source_team: { id: number; name: string };
  requester_team: { id: number; name: string };
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  status_label: string;
  can_approve: boolean;
  can_reject: boolean;
  can_cancel: boolean;
}

@Injectable({ providedIn: 'root' })
export class TeamApiService {
  private readonly API = (typeof window !== 'undefined' ? window.location.origin : '') + '/api/teams';

  constructor(private http: HttpClient) {}

  getTeams(): Observable<any> {
    return this.http.get(`${this.API}/`);
  }

  createTeam(payload: any): Observable<any> {
    return this.http.post(`${this.API}/`, payload);
  }

  updateTeam(teamId: number, payload: any): Observable<any> {
    return this.http.put(`${this.API}/${teamId}/`, payload);
  }

  updateMember(teamId: number, employeeId: number, action: 'add' | 'remove'): Observable<any> {
    return this.http.post(`${this.API}/${teamId}/members/`, { employee_id: employeeId, action });
  }

  getRequests(): Observable<any> {
    return this.http.get(`${this.API}/requests/`);
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
