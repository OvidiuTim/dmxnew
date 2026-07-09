import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface AuthSession {
  ok: boolean;
  role: 'admin' | 'app_user';
  auth_type: 'legacy' | 'app_user';
  permissions?: string[];
  can_access?: boolean;
  login_redirect_path?: string;
  app_user?: any;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = (typeof window !== 'undefined' ? window.location.origin : '') + '/api';
  private authenticated = false;
  private session: AuthSession | null = null;

  constructor(private http: HttpClient) {}

  isLoggedIn(): boolean { return this.authenticated; }
  currentSession(): AuthSession | null { return this.session; }

  login(password: string) {
    return this.http.post<AuthSession>(
      `${this.API}/auth/login/`,
      { password },
      { withCredentials: true }
    ).pipe(tap((session) => this.setSession({ ...session, auth_type: 'legacy' })));
  }

  appLogin(username: string, pin: string) {
    return this.http.post<AuthSession>(
      `${this.API}/app-auth/login/`,
      { username, pin },
      { withCredentials: true }
    ).pipe(tap((session) => this.setSession(session)));
  }

  verify(): Observable<boolean> {
    return this.verifySession().pipe(map(() => true));
  }

  verifySession(route?: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.API}/auth/verify/`, {}, { withCredentials: true })
      .pipe(
        tap((session) => this.setSession({ ...session, auth_type: 'legacy' })),
        catchError(() => this.http.post<AuthSession>(
          `${this.API}/app-auth/verify/`,
          { route },
          { withCredentials: true }
        ).pipe(tap((session) => this.setSession(session))))
      );
  }

  canAccess(route: string): Observable<boolean> {
    return this.verifySession(route).pipe(
      map((session) => {
        if (session.auth_type === 'legacy' || session.role === 'admin') {
          return true;
        }
        if (session.can_access !== undefined) {
          return !!session.can_access;
        }
        return !!session.permissions?.includes(route);
      })
    );
  }

  adminAppLogin(password: string) {
    return this.http.post<{ ok: boolean }>(`${this.API}/app-admin/login/`, { password }, { withCredentials: true });
  }

  adminAppVerify() {
    return this.http.post<{ ok: boolean }>(`${this.API}/app-admin/verify/`, {}, { withCredentials: true });
  }

  getAdminAppUsers() {
    return this.http.get<{ routes: string[]; users: any[] }>(`${this.API}/app-admin/users/`, { withCredentials: true });
  }

  updateAdminAppUser(payload: any) {
    return this.http.post<{ ok: boolean; user: any }>(`${this.API}/app-admin/users/`, payload, { withCredentials: true });
  }

  logout(): void {
    this.authenticated = false;
    this.session = null;
    this.http.post(`${this.API}/auth/logout/`, {}, { withCredentials: true }).subscribe({ error: () => {} });
    this.http.post(`${this.API}/app-auth/logout/`, {}, { withCredentials: true }).subscribe({ error: () => {} });
  }

  private setSession(session: AuthSession): void {
    this.authenticated = true;
    this.session = session;
  }
}
