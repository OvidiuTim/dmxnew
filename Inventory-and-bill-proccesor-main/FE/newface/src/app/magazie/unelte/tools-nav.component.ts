import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-tools-nav',
  templateUrl: './tools-nav.component.html',
  styleUrls: ['./tools-nav.component.css']
})
export class ToolsNavComponent {
  @Input() active: 'list' | 'add' | 'handover' = 'list';

  constructor(public auth: AuthService, private router: Router) {}

  canRoute(_route: string): boolean {
    const session = this.auth.currentSession();
    return !!session && (session.role === 'admin' || session.auth_type === 'legacy' || !!session.modules?.includes('tools'));
  }

  isAppUser(): boolean {
    return this.auth.currentSession()?.auth_type === 'app_user';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
