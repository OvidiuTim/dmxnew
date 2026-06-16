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

    return this.auth.canAccess(permissionRoute).pipe(
      map(ok => ok ? true : this.router.createUrlTree(['/no-access'])),
      catchError(() => of(this.router.createUrlTree(['/login'])))
    );
  }
}
