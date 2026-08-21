import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OrganizationEmployee {
  id: number;
  name: string;
  serie: string;
  trade: string;
  active: boolean;
  employment_status: string;
}

export interface OrganizationMember {
  id: number;
  name: string;
  role: string;
  department_id: number;
  reports_to_id: number | null;
  sort_order: number;
  photo: string;
  associated: boolean;
  employee: OrganizationEmployee | null;
  metadata?: Record<string, any>;
  team_role?: 'member' | 'leader' | 'supervisor' | 'both';
}

export interface OrganizationTeamLink {
  id: number;
  name: string;
  active: boolean;
  leader_id: number;
  supervisor_id: number;
}

export interface OrganizationDepartment {
  id: number;
  name: string;
  subtitle: string;
  color: string;
  parent_id: number | null;
  sort_order: number;
  team: OrganizationTeamLink | null;
  members: OrganizationMember[];
  children: OrganizationDepartment[];
}

export interface OrganizationResponse {
  roots: OrganizationDepartment[];
  departments: Array<{ id: number; name: string; parent_id: number | null; sort_order: number; team: OrganizationTeamLink | null }>;
  members: OrganizationMember[];
  employees: OrganizationEmployee[];
  summary: { departments: number; members: number; associated: number; unassociated: number };
  can_manage: boolean;
}

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly api = '/api/organization/';

  constructor(private http: HttpClient) {}

  getOrganization(): Observable<OrganizationResponse> {
    return this.http.get<OrganizationResponse>(this.api);
  }

  addMember(payload: any): Observable<any> {
    return this.http.post<any>(this.api, payload);
  }

  updateMember(memberId: number, payload: any): Observable<any> {
    return this.http.patch<any>(`${this.api}members/${memberId}/`, payload);
  }

  convertDepartmentToTeam(departmentId: number, payload: { leader_id: number; supervisor_id: number }): Observable<any> {
    return this.http.post<any>(`${this.api}departments/${departmentId}/team/`, payload);
  }
}
