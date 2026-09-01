import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export interface AdminModuleDefinition {
  code: string;
  label: string;
  description: string;
  icon: string;
  main_route: string;
}

@Component({
  selector: 'app-admin-app-page',
  templateUrl: './admin-app-page.component.html',
  styleUrls: ['./admin-app-page.component.css']
})
export class AdminAppPageComponent implements OnInit {
  password = '';
  authenticated = false;
  loading = false;
  error: string | null = null;
  success: string | null = null;
  routes: string[] = [];
  users: any[] = [];
  modules: AdminModuleDefinition[] = [];
  moduleSelections: Record<string, Set<number>> = {};
  searches: Record<string, string> = {};
  savingModule: string | null = null;

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.adminAppVerify().subscribe({
      next: ({ ok }) => {
        this.authenticated = !!ok;
        if (ok) this.loadData();
      },
      error: () => this.authenticated = false
    });
  }

  login(): void {
    if (!this.password) return;
    this.loading = true;
    this.clearMessages();
    this.auth.adminAppLogin(this.password).subscribe({
      next: () => {
        this.authenticated = true;
        this.password = '';
        this.loadData();
      },
      error: () => {
        this.loading = false;
        this.error = 'Parola admin este invalidă.';
      }
    });
  }

  loadData(): void {
    this.loading = true;
    this.clearMessages();
    this.auth.getAdminModules().subscribe({
      next: (res) => {
        this.routes = res.routes || [];
        this.modules = res.modules || [];
        this.setUsers(res.users || []);
        this.loading = false;
      },
      error: () => {
        this.error = 'Nu pot încărca modulele și utilizatorii aplicației.';
        this.loading = false;
      }
    });
  }

  filteredUsers(module: AdminModuleDefinition): any[] {
    const query = String(this.searches[module.code] || '').trim().toLocaleLowerCase('ro-RO');
    if (!query) return this.users;
    return this.users.filter(user => [user.employee?.name, user.username, user.employee?.serie]
      .some(value => String(value || '').toLocaleLowerCase('ro-RO').includes(query)));
  }

  selectedUsers(moduleCode: string): any[] {
    const selection = this.moduleSelections[moduleCode] || new Set<number>();
    return this.users.filter(user => selection.has(user.id));
  }

  isSelected(moduleCode: string, userId: number): boolean {
    return !!this.moduleSelections[moduleCode]?.has(userId);
  }

  isInherited(moduleCode: string, user: any): boolean {
    return !!user.inherited_modules?.includes(moduleCode);
  }

  isManual(moduleCode: string, user: any): boolean {
    return !!user.manual_module_access?.[moduleCode];
  }

  roleLabel(role: string): string {
    const labels: Record<string, string> = {
      team_leader: 'Șef de echipă',
      supervisor: 'Supervisor',
      alert_level_1: 'Nivel 1',
      alert_level_2: 'Nivel 2',
    };
    return labels[role] || role;
  }

  roleSummary(user: any): string {
    return (user?.roles || []).map((role: string) => this.roleLabel(role)).join(', ');
  }

  toggleModuleUser(moduleCode: string, user: any, checked: boolean): void {
    if (this.isInherited(moduleCode, user) && !checked) return;
    const selection = this.moduleSelections[moduleCode] || new Set<number>();
    checked ? selection.add(user.id) : selection.delete(user.id);
    this.moduleSelections[moduleCode] = new Set(selection);
    this.success = null;
  }

  addVisible(module: AdminModuleDefinition): void {
    const selection = this.moduleSelections[module.code] || new Set<number>();
    this.filteredUsers(module).forEach(user => selection.add(user.id));
    this.moduleSelections[module.code] = new Set(selection);
  }

  saveModule(module: AdminModuleDefinition): void {
    this.savingModule = module.code;
    this.clearMessages();
    const ids = Array.from(this.moduleSelections[module.code] || []);
    this.auth.saveAdminModuleAccess(module.code, ids).subscribe({
      next: (res) => {
        this.setUsers(res.users || []);
        this.savingModule = null;
        this.success = `Accesul pentru modulul „${module.label}” a fost salvat.`;
      },
      error: (response) => {
        this.savingModule = null;
        this.error = response?.error?.error || `Nu pot salva modulul „${module.label}”.`;
      }
    });
  }

  toggleRoute(user: any, route: string, checked: boolean): void {
    const previous = !!user.permissions?.[route];
    user.permissions[route] = checked;
    this.auth.updateAdminAppUser({ app_user_id: user.id, route, can_access: checked }).subscribe({
      next: (res) => Object.assign(user, res.user),
      error: () => {
        user.permissions[route] = previous;
        this.error = 'Nu pot salva permisiunea granulară.';
      }
    });
  }

  toggleActive(user: any, checked: boolean): void {
    const previous = !!user.is_active;
    user.is_active = checked;
    this.auth.updateAdminAppUser({ app_user_id: user.id, is_active: checked }).subscribe({
      next: (res) => Object.assign(user, res.user),
      error: () => {
        user.is_active = previous;
        this.error = 'Nu pot salva statusul contului.';
      }
    });
  }

  trackByCode(_index: number, item: AdminModuleDefinition): string { return item.code; }
  trackById(_index: number, item: any): number { return item.id; }

  private setUsers(users: any[]): void {
    this.users = users;
    this.modules.forEach(module => {
      this.moduleSelections[module.code] = new Set(
        users.filter(user => user.module_access?.[module.code]).map(user => user.id)
      );
    });
  }

  private clearMessages(): void {
    this.error = null;
    this.success = null;
  }
}
