import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-admin-app-page',
  templateUrl: './admin-app-page.component.html',
  styleUrls: ['./admin-app-page.component.css']
})
export class AdminAppPageComponent implements OnInit {
  password = '';
  authenticated = false;
  loading = false;
  error: string | null = null;
  routes: string[] = [];
  users: any[] = [];

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.adminAppVerify().subscribe({
      next: (res) => {
        this.authenticated = !!res.ok;
        if (this.authenticated) {
          this.loadData();
        }
      },
      error: () => {
        this.authenticated = false;
      }
    });
  }

  login(): void {
    if (!this.password) return;
    this.loading = true;
    this.error = null;
    this.auth.adminAppLogin(this.password).subscribe({
      next: () => {
        this.loading = false;
        this.authenticated = true;
        this.password = '';
        this.loadData();
      },
      error: () => {
        this.loading = false;
        this.error = 'Parola admin este invalidă.';
      }
    });
  }

  loadData(): void {
    this.loading = true;
    this.auth.getAdminAppUsers().subscribe({
      next: (res) => {
        this.routes = res.routes || [];
        this.users = (res.users || []).map((user) => ({
          ...user,
          _savedLoginRedirectPath: user.login_redirect_path || '/pontaj',
        }));
        this.loading = false;
      },
      error: () => {
        this.error = 'Nu pot încărca utilizatorii aplicației.';
        this.loading = false;
      }
    });
  }

  toggleRoute(user: any, route: string, checked: boolean): void {
    const previous = !!user.permissions?.[route];
    user.permissions[route] = checked;
    this.auth.updateAdminAppUser({
      app_user_id: user.id,
      route,
      can_access: checked,
    }).subscribe({
      next: (res) => Object.assign(user, res.user),
      error: () => {
        user.permissions[route] = previous;
        this.error = 'Nu pot salva permisiunea.';
      }
    });
  }

  toggleActive(user: any, checked: boolean): void {
    const previous = !!user.is_active;
    user.is_active = checked;
    this.auth.updateAdminAppUser({
      app_user_id: user.id,
      is_active: checked,
    }).subscribe({
      next: (res) => Object.assign(user, res.user),
      error: () => {
        user.is_active = previous;
        this.error = 'Nu pot salva statusul.';
      }
    });
  }

  saveLoginRedirect(user: any): void {
    const nextPath = this.normalizeLoginRedirect(user.login_redirect_path);
    const previous = user._savedLoginRedirectPath || '/pontaj';
    user.login_redirect_path = nextPath;
    if (nextPath === previous) {
      return;
    }
    this.auth.updateAdminAppUser({
      app_user_id: user.id,
      login_redirect_path: nextPath,
    }).subscribe({
      next: (res) => {
        Object.assign(user, res.user);
        user._savedLoginRedirectPath = res.user.login_redirect_path || '/pontaj';
      },
      error: () => {
        user.login_redirect_path = previous;
        this.error = 'Nu pot salva redirectul după login.';
      }
    });
  }

  private normalizeLoginRedirect(value: string): string {
    const path = String(value || '').trim();
    if (!path || path.includes('://') || path.startsWith('//')) {
      return '/pontaj';
    }
    return path.startsWith('/') ? path : `/${path}`;
  }
}
