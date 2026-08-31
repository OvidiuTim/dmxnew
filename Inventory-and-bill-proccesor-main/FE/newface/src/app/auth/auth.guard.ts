import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    const permissionRoute = String(route.data?.['permissionRoute'] || `/${route.routeConfig?.path || 'pontaj'}`);
    const moduleCode = String(route.data?.['moduleCode'] || '');
    const isModuleEntry = !!route.data?.['moduleEntry'];
    const requiresGranular = !!route.data?.['requiresGranular'];

    return this.auth.verifySession(permissionRoute, moduleCode || undefined).pipe(
      map(session => {
        if (session.role === 'admin' || session.auth_type === 'legacy') return true;
        const hasModule = !moduleCode || !!(session.can_access_module ?? session.modules?.includes(moduleCode));
        if (!hasModule && isModuleEntry) {
          const fallback = this.auth.firstAvailableModuleRoute(session);
          return fallback
            ? this.router.parseUrl(fallback)
            : this.router.createUrlTree(['/no-access'], { queryParams: { reason: 'no-modules' } });
        }
        if (!hasModule) {
          const fallback = this.auth.firstAvailableModuleRoute(session);
          return fallback
            ? this.router.parseUrl(fallback)
            : this.router.createUrlTree(['/no-access']);
        }
        if (!requiresGranular) return true;
        const hasPage = session.can_access ?? !!session.permissions?.includes(permissionRoute);
        return hasPage ? true : this.router.createUrlTree(['/no-access']);
      }),
      catchError(() => of(this.router.createUrlTree(['/login'])))
    );
  }
}
