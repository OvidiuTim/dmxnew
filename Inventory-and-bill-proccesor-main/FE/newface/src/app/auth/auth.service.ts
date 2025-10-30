import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = (typeof window !== 'undefined' ? window.location.origin : '') + '/api';
  private readonly KEY = 'pontaj_token';

  constructor(private http: HttpClient) {}

  get token(): string | null { return localStorage.getItem(this.KEY); }
  isLoggedIn(): boolean { return !!this.token; }

  login(password: string) {
    return this.http.post<{token:string, expires_in:number}>(`${this.API}/auth/login/`, { password })
      .pipe(tap(res => localStorage.setItem(this.KEY, res.token)));
  }

  verify(): Observable<boolean> {
    const tok = this.token;
    if (!tok) return of(false);
    return this.http.post(`${this.API}/auth/verify/`, { token: tok })
      .pipe(map(() => true));
  }

  logout() {
    localStorage.removeItem(this.KEY);
  }
}
