import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface EmployeeCost {
  id: number; name: string; serie: string; company: string; seconds: number; hours: string; cost: string;
  estimated_seconds: number; missing_rate_seconds: number; open_sessions: number;
}
export interface PointCost { name: string; seconds: number; hours: string; cost: string; open_sessions: number; }
export interface SiteCosts {
  seconds: number; hours: string; labor_cost: string; expense_cost: string; total_cost: string;
  open_sessions: number; estimated_seconds: number; missing_rate_seconds: number; employee_count: number;
  employees: EmployeeCost[]; categories: { category: string; amount: string }[]; points: PointCost[];
}
export interface ConstructionSite {
  id: number; code: string; name: string; status: string; client: string; manager: string; address: string;
  latitude: number | null; longitude: number | null; start_date: string | null; end_date: string | null;
  budget: string | null; notes: string; points: string[]; version: number;
  costs: SiteCosts; lifetime_cost: string; budget_remaining: string | null;
}
export interface AttendancePoint {
  name: string; latitude: number | null; longitude: number | null; site_id: number | null; site_name: string | null;
  is_primary: boolean; history?: PointCost;
}
export interface SitesResponse {
  sites: ConstructionSite[]; totals: SiteCosts; unallocated: SiteCosts; unallocated_lifetime: SiteCosts;
  points: AttendancePoint[]; can_manage: boolean; categories: { value: string; label: string }[];
}
export interface SiteExpense {
  id: number; date: string; category: string; description: string; supplier: string; reference: string;
  amount: string; notes: string; cancelled_at: string | null; cancellation_reason: string; created_by: string;
}
export interface AuditEvent { id: number; action: string; actor: string; created_at: string; before: any; after: any; }

@Injectable({ providedIn: 'root' })
export class SiteApiService {
  private readonly base = window.location.origin + '/api/construction-sites/';
  constructor(private http: HttpClient) {}
  private params(start: string, end: string, page = 1): HttpParams {
    let params = new HttpParams().set('page', page);
    if (start) params = params.set('start', start);
    if (end) params = params.set('end', end);
    return params;
  }
  list(start: string, end: string) { return this.http.get<SitesResponse>(this.base, { params: this.params(start, end) }); }
  save(id: number | null, data: unknown) {
    return id ? this.http.patch<{ site: ConstructionSite }>(`${this.base}${id}/`, data)
      : this.http.post<{ site: ConstructionSite }>(this.base, data);
  }
  importPoints() { return this.http.post<{ created_count: number }>(`${this.base}import/`, {}); }
  expenses(id: number, start: string, end: string, page: number) {
    return this.http.get<{ expenses: SiteExpense[]; count: number }>(`${this.base}${id}/expenses/`, { params: this.params(start, end, page) });
  }
  exportExpenses(id: number, start: string, end: string) {
    return this.http.get(`${this.base}${id}/expenses/`, { params: this.params(start, end).set('format', 'csv'), responseType: 'blob' });
  }
  addExpense(id: number, data: unknown) { return this.http.post(`${this.base}${id}/expenses/`, data); }
  cancelExpense(id: number, expenseId: number, reason: string) { return this.http.post(`${this.base}${id}/expenses/${expenseId}/cancel/`, { reason }); }
  audit(id: number, page: number) {
    return this.http.get<{ events: AuditEvent[]; count: number }>(`${this.base}${id}/audit/`, { params: { page } });
  }
}
