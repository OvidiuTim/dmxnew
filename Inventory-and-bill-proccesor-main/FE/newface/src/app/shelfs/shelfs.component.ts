import { Component, HostListener } from '@angular/core';

@Component({
  selector: 'app-shelfs',
  templateUrl: './shelfs.component.html',
  styleUrls: ['./shelfs.component.css']
})
export class ShelfsComponent {
  menuOpen = false;

  toggleMenu() { this.menuOpen = !this.menuOpen; }
  closeMenu() { this.menuOpen = false; }

  // Close menu when clicking outside of navbar content (on main area)
  closeMenuOnOutsideClick(event: MouseEvent) {
    // no-op here; the (click) on main already calls this, but keep for future guards
    // If needed, inspect event.target to avoid closing on inner clicks.
  }

  // Close on ESC
  @HostListener('document:keydown.escape')
  onEsc() { this.closeMenu(); }

  // Optional: auto-close if window resized to desktop
  @HostListener('window:resize', ['$event'])
  onResize() {
    if (window.innerWidth > 768 && this.menuOpen) this.closeMenu();
  }
}
