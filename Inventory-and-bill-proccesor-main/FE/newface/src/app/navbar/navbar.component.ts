import { Component, EventEmitter, HostListener, Output } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';

export type NavLink = { label: string; path: string; icon: string; permissionRoute?: string; active?: boolean };
export type NavGroup = { label: string; links: NavLink[] };

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent {
  @Output() linkClick = new EventEmitter<string>();

  groups: NavGroup[] = [
    {
      label: 'General',
      links: [{ label: 'Dashboard', path: '/dashboard', icon: 'dashboard' }]
    },
    {
      label: 'Pontaj',
      links: [
        { label: 'Prezență zilnică', path: '/pontaj', icon: 'clock' },
        { label: 'Rapoarte', path: '/pontaj/rapoarte', icon: 'chart' },
        { label: 'Fișe angajați', path: '/pontaj/fisa-angajat', icon: 'badge' },
        { label: 'Echipe și program', path: '/pontaj/echipe', icon: 'team' },
        { label: 'Concedii', path: '/pontaj/concedii', icon: 'calendar' },
      ]
    },
    {
      label: 'Magazie',
      links: [
        { label: 'Privire generală', path: '/magazie', icon: 'warehouse' },
        { label: 'Angajați', path: '/angajati', icon: 'users' },
        { label: 'Unelte', path: '/unelte', icon: 'tool' },
        { label: 'Predare / primire', path: '/predare-unealta', icon: 'transfer' },
        { label: 'Materiale', path: '/materiale', icon: 'box' },
        { label: 'Schelă și cofraje', path: '/schela', icon: 'layers' },
        { label: 'Rafturi', path: '/rafturi', icon: 'shelf' },
        { label: 'Istoric', path: '/history', icon: 'history' },
      ]
    },
    {
      label: 'Resurse umane',
      links: [{ label: 'Documente', path: '/hr/documente', icon: 'document' }]
    }
  ];

  menuOpen = false;

  constructor(private router: Router, private auth: AuthService) {
    this.markActive(this.router.url);
    // Update active link whenever route changes
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.markActive(e.urlAfterRedirects);
      });
  }

  private markActive(currentUrl: string) {
    this.groups.forEach(group => group.links.forEach(link => {
      const exactPontaj = link.path === '/pontaj' && currentUrl === '/pontaj';
      link.active = exactPontaj || (link.path !== '/pontaj' && currentUrl.startsWith(link.path));
    }));
  }

  get userName(): string {
    const session = this.auth.currentSession();
    return session?.app_user?.display_name || session?.app_user?.username || (session?.role === 'admin' ? 'Administrator' : 'Utilizator');
  }

  get userRole(): string {
    return this.auth.currentSession()?.role === 'app_user' ? 'Utilizator aplicație' : 'Administrator';
  }

  get initials(): string {
    return this.userName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'DM';
  }

  visibleLinks(group: NavGroup): NavLink[] {
    const session = this.auth.currentSession();
    if (!session || session.role === 'admin' || session.auth_type === 'legacy') return group.links;
    return group.links.filter(link => session.permissions?.includes(link.permissionRoute || link.path));
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }
  closeMenu()  { this.menuOpen = false; }

  onLinkClick(link: NavLink, event?: MouseEvent) {
    this.linkClick.emit(link.label);
    this.closeMenu();
    this.router.navigateByUrl(link.path);
    if (event) event.preventDefault();
  }

  logout(): void {
    this.auth.logout();
    this.closeMenu();
    this.router.navigate(['/login']);
  }

  @HostListener('document:keydown.escape') onEsc() { this.closeMenu(); }
  @HostListener('window:resize') onResize() {
    if (window.innerWidth > 768 && this.menuOpen) this.closeMenu();
  }
}
