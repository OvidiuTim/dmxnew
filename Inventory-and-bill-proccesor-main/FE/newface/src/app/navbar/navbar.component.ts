import { Component, EventEmitter, HostListener, Output } from '@angular/core';
import { NgFor, NgClass } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

export type NavLink = { label: string; path: string; active?: boolean };

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent {
  @Output() linkClick = new EventEmitter<string>();

  brand = 'DMX CONSTRUCTION';

  links: NavLink[] = [
    { label: 'Angajați', path: '/angajati' },
    { label: 'Rafturi',  path: '/rafturi' },
    { label: 'Unelte',   path: '/unelte' },
    { label: 'Schela',   path: '/schela' },
    { label: 'Istoric',  path: '/history' },
  ];

  menuOpen = false;

  constructor(private router: Router) {
    // Update active link whenever route changes
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.markActive(e.urlAfterRedirects);
      });
  }

  private markActive(currentUrl: string) {
    this.links.forEach(l => {
      l.active = currentUrl.startsWith(l.path);
    });
  }

  toggleMenu() { this.menuOpen = !this.menuOpen; }
  closeMenu()  { this.menuOpen = false; }

  onLinkClick(link: NavLink, event?: MouseEvent) {
    this.linkClick.emit(link.label);
    this.closeMenu();
    this.router.navigateByUrl(link.path);
    if (event) event.preventDefault();
  }

  @HostListener('document:keydown.escape') onEsc() { this.closeMenu(); }
  @HostListener('window:resize') onResize() {
    if (window.innerWidth > 768 && this.menuOpen) this.closeMenu();
  }
}
