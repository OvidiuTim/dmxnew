import { Component } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

// DEBUG TEMPORAR — de șters după diagnosticarea buclei de refresh.
// Dacă BOOT_ID se schimbă la fiecare ciclu => pagina se reîncarcă (dev-server).
// Dacă rămâne același și apar NavigationStart => buclă de navigare în aplicație.
const DMX_BOOT_ID = Math.random().toString(36).slice(2, 8);

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  shellVisible = false;
  private readonly publicRoutes = ['/login', '/clockinandout', '/clockinandoutdriver', '/chef', '/termeniigdpr', '/admin-app-page', '/no-access', '/team-dashboard'];
  private readonly legacyRoutes = ['/unelte', '/predare-unealta', '/history'];

  constructor(private router: Router) {
    this.updateShell(this.router.url);
    // DEBUG TEMPORAR — de șters după diagnosticare.
    console.log('[DMX-DEBUG] bootstrap', DMX_BOOT_ID, 'url:', this.router.url);
    this.router.events.subscribe((event: any) => {
      if (event instanceof NavigationStart) {
        console.log('[DMX-DEBUG]', DMX_BOOT_ID, 'NavigationStart ->', event.url, '| trigger:', event.navigationTrigger, '| restoredState:', !!event.restoredState);
      }
      if (event instanceof NavigationCancel) {
        console.log('[DMX-DEBUG]', DMX_BOOT_ID, 'NavigationCancel ->', event.url, '| reason:', event.reason);
      }
    });
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => this.updateShell(event.urlAfterRedirects));
  }
  title = 'bloom-in';

  private updateShell(url: string): void {
    const path = (url || '/').split('?')[0].split('#')[0];
    const standaloneRoutes = [...this.publicRoutes, ...this.legacyRoutes];
    this.shellVisible = !standaloneRoutes.some(route => path === route || path.startsWith(`${route}/`));
  }
}
