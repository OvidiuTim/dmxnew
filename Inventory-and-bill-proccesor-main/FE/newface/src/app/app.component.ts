import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  shellVisible = false;
  private readonly publicRoutes = ['/login', '/clockinandout', '/clockinandoutdriver', '/admin-app-page', '/no-access'];

  constructor(private router: Router) {
    this.updateShell(this.router.url);
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => this.updateShell(event.urlAfterRedirects));
  }
  title = 'newface';

  private updateShell(url: string): void {
    const path = (url || '/').split('?')[0].split('#')[0];
    this.shellVisible = !this.publicRoutes.some(route => path === route || path.startsWith(`${route}/`));
  }
}
