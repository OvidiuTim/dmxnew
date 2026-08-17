import { Component, EventEmitter, HostListener, OnDestroy, Output } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { TeamApiService } from '../teams/team-api.service';

export type NavLink = { label: string; path: string; icon: string; permissionRoute?: string; active?: boolean; attentionCount?: number };
export type NavGroup = { label: string; moduleCode: string; links: NavLink[] };

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnDestroy {
  @Output() linkClick = new EventEmitter<string>();

  groups: NavGroup[] = [
    {
      label: 'Pontaj',
      moduleCode: 'attendance',
      links: [
        { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', permissionRoute: '/dashboard' },
        { label: 'Prezență zilnică', path: '/pontaj', icon: 'schedule', permissionRoute: '/pontaj' },
        { label: 'Rapoarte', path: '/pontaj/rapoarte', icon: 'bar_chart', permissionRoute: '/pontaj/rapoarte' },
        { label: 'Fișe angajați', path: '/pontaj/fisa-angajat', icon: 'badge', permissionRoute: '/pontaj/fisa-angajat' },
        { label: 'Cazări', path: '/pontaj/cazari', icon: 'apartment', permissionRoute: '/pontaj/cazari' },
      ]
    },
    {
      label: 'Echipe și program',
      moduleCode: 'teams_schedule',
      links: [
        { label: 'Echipe permanente', path: '/pontaj/echipe', icon: 'groups', permissionRoute: '/pontaj/echipe' },
        { label: 'Echipa mea', path: '/pontaj/echipa-mea', icon: 'group', permissionRoute: '/pontaj/echipa-mea' },
        { label: 'Concedii', path: '/pontaj/concedii', icon: 'calendar_month', permissionRoute: '/pontaj/concedii' },
        { label: 'Echipele de azi', path: '/pontaj/echipe-azi', icon: 'today', permissionRoute: '/pontaj/echipe-azi' },
        { label: 'Personal', path: '/pontaj/personal', icon: 'group_add', permissionRoute: '/pontaj/personal' },
        { label: 'Notificări', path: '/pontaj/notificari', icon: 'notifications', permissionRoute: '/pontaj/notificari', attentionCount: 0 },
      ]
    },
    {
      label: 'Magazie',
      moduleCode: 'warehouse',
      links: [
        { label: 'Privire generală', path: '/magazie', icon: 'warehouse', permissionRoute: '/magazie' },
        { label: 'Scule', path: '/magazie/scule', icon: 'tool', permissionRoute: '/magazie/scule' },
        { label: 'Echipamente SSM', path: '/magazie/echipamente-ssm', icon: 'shield', permissionRoute: '/magazie/echipamente-ssm' },
        { label: 'Istoric', path: '/magazie/istoric', icon: 'history', permissionRoute: '/magazie/istoric' },
      ]
    },
    {
      label: 'Unelte',
      moduleCode: 'tools',
      links: [{ label: 'Registru unelte', path: '/unelte', icon: 'construction', permissionRoute: '/unelte' }]
    }
  ];

  menuOpen = false;
  private notificationSubscription?: Subscription;

  constructor(private router: Router, private auth: AuthService, private teamsApi: TeamApiService) {
    this.markActive(this.router.url);
    // Update active link whenever route changes
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.markActive(e.urlAfterRedirects);
      });
    if (this.visibleLinks(this.groups[1]).length) {
      this.notificationSubscription = timer(0, 30000).pipe(
        switchMap(() => this.teamsApi.getNotificationSummary().pipe(catchError(() => of({ attention_count: 0 }))))
      ).subscribe(response => this.setNotificationCount(Number(response?.attention_count || 0)));
    }
  }

  ngOnDestroy(): void {
    this.notificationSubscription?.unsubscribe();
  }

  private markActive(currentUrl: string) {
    this.groups.forEach(group => group.links.forEach(link => {
      const sectionRoot = link.path === '/pontaj' || link.path === '/magazie';
      link.active = currentUrl === link.path || (!sectionRoot && currentUrl.startsWith(`${link.path}/`));
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

  get brandRoute(): string {
    return this.auth.firstAvailableModuleRoute() || '/no-access?reason=no-modules';
  }

  visibleLinks(group: NavGroup): NavLink[] {
    const session = this.auth.currentSession();
    if (!session || session.role === 'admin' || session.auth_type === 'legacy') return group.links;
    if (!session.modules?.includes(group.moduleCode)) return [];
    return group.links;
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

  @HostListener('window:team-notifications-changed') refreshNotifications(): void {
    if (!this.visibleLinks(this.groups[1]).length) return;
    this.teamsApi.getNotificationSummary().pipe(catchError(() => of({ attention_count: 0 }))).subscribe(
      response => this.setNotificationCount(Number(response?.attention_count || 0))
    );
  }

  private setNotificationCount(count: number): void {
    const link = this.groups[1].links.find(item => item.path === '/pontaj/notificari');
    if (link) link.attentionCount = count;
  }

  @HostListener('document:keydown.escape') onEsc() { this.closeMenu(); }
  @HostListener('window:resize') onResize() {
    if (window.innerWidth > 768 && this.menuOpen) this.closeMenu();
  }
}
