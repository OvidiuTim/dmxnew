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
      links: [{ label: 'Dashboard', path: '/dashboard', icon: 'dashboard', permissionRoute: '/dashboard' }]
    },
    {
      label: 'Pontaj',
      links: [
        { label: 'Prezență zilnică', path: '/pontaj', icon: 'schedule', permissionRoute: '/pontaj' },
        { label: 'Rapoarte', path: '/pontaj/rapoarte', icon: 'bar_chart', permissionRoute: '/pontaj/rapoarte' },
        { label: 'Fișe angajați', path: '/pontaj/fisa-angajat', icon: 'badge', permissionRoute: '/pontaj/fisa-angajat' },
      ]
    },
    {
      label: 'Echipe și program',
      links: [
        { label: 'Echipe permanente', path: '/pontaj/echipe', icon: 'groups', permissionRoute: '/pontaj/echipe' },
        { label: 'Echipele de azi', path: '/pontaj/echipe-azi', icon: 'today', permissionRoute: '/pontaj/echipe-azi' },
        { label: 'Personal disponibil', path: '/pontaj/personal-disponibil', icon: 'person_add', permissionRoute: '/pontaj/personal-disponibil' },
        { label: 'Concedii', path: '/pontaj/concedii', icon: 'calendar_month', permissionRoute: '/pontaj' },
      ]
    },
    {
      label: 'Magazie',
      links: [
        { label: 'Privire generală', path: '/magazie', icon: 'warehouse', permissionRoute: '/magazie' },
        { label: 'Scule', path: '/magazie/scule', icon: 'tool', permissionRoute: '/unelte' },
        { label: 'Echipamente SSM', path: '/magazie/echipamente-ssm', icon: 'shield', permissionRoute: '/unelte' },
        { label: 'Istoric', path: '/magazie/istoric', icon: 'history', permissionRoute: '/history' },
      ]
    },
    {
      label: 'Resurse umane',
      links: [{ label: 'Documente', path: '/hr/documente', icon: 'document', permissionRoute: '/pontaj/fisa-angajat' }]
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
      link.active = currentUrl === link.path || currentUrl.startsWith(`${link.path}/`);
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
