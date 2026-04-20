import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = (typeof window !== 'undefined' ? window.location.origin : '') + '/api';
  private authenticated = false;

  constructor(private http: HttpClient) {}

  isLoggedIn(): boolean { return this.authenticated; }

  login(password: string) {
    return this.http.post<{ok:boolean, role:string, expires_in:number}>(
      `${this.API}/auth/login/`,
      { password },
      { withCredentials: true }
    ).pipe(tap(() => { this.authenticated = true; }));
  }

  verify(): Observable<boolean> {
    return this.http.post(`${this.API}/auth/verify/`, {}, { withCredentials: true })
      .pipe(
        tap(() => { this.authenticated = true; }),
        map(() => true)
      );
  }

  logout() {
    this.authenticated = false;
  }
}
