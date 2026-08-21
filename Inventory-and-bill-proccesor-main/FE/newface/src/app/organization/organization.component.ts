import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  OrganizationDepartment,
  OrganizationEmployee,
  OrganizationMember,
  OrganizationResponse,
  OrganizationService,
} from './organization.service';

@Component({
  selector: 'app-organization',
  templateUrl: './organization.component.html',
  styleUrls: ['./organization.component.css'],
})
export class OrganizationComponent implements OnInit {
  roots: OrganizationDepartment[] = [];
  departments: OrganizationResponse['departments'] = [];
  members: OrganizationMember[] = [];
  employees: OrganizationEmployee[] = [];
  summary = { departments: 0, members: 0, associated: 0, unassociated: 0 };
  canManage = false;
  loading = true;
  saving = false;
  converting = false;
  error = '';
  notice = '';
  search = '';
  dialogOpen = false;
  teamDialogOpen = false;
  teamDepartment: OrganizationDepartment | null = null;
  teamForm = { leader_id: null as number | null, supervisor_id: null as number | null };
  editingMemberId: number | null = null;
  failedPhotos = new Set<number>();
  collapsedDepartments = new Set<number>();
  departmentLabels = new Map<number, string>();
  form = this.emptyForm();

  constructor(private api: OrganizationService, private router: Router) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getOrganization().subscribe({
      next: response => {
        this.applyResponse(response);
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.error = error?.error?.error || 'Organigrama nu a putut fi încărcată.';
      },
    });
  }

  openAdd(): void {
    this.editingMemberId = null;
    this.form = this.emptyForm();
    if (this.departments.length) this.form.department_id = this.departments[0].id;
    this.dialogOpen = true;
  }

  openEdit(member: OrganizationMember, event: Event): void {
    event.stopPropagation();
    this.editingMemberId = member.id;
    this.form = {
      name: member.name,
      role: member.role,
      department_id: member.department_id,
      reports_to_id: member.reports_to_id,
      employee_id: member.employee?.id ?? null,
      sort_order: member.sort_order,
    };
    this.dialogOpen = true;
  }

  closeDialog(): void {
    if (this.saving) return;
    this.dialogOpen = false;
  }

  associatedDepartmentMembers(department: OrganizationDepartment | null): OrganizationMember[] {
    return (department?.members || []).filter(member => !!member.employee?.id && member.employee.active);
  }

  openTeamDialog(department: OrganizationDepartment, event?: Event): void {
    event?.stopPropagation();
    if (department.team) return;
    const candidates = this.associatedDepartmentMembers(department);
    if (!candidates.length) return;
    const leader = candidates.find(member => /șef de echipă/i.test(member.role)) || candidates[0];
    const supervisor = candidates.find(member => /supervisor/i.test(member.role)) || leader;
    this.teamDepartment = department;
    this.teamForm = {
      leader_id: leader.employee!.id,
      supervisor_id: supervisor.employee!.id,
    };
    this.teamDialogOpen = true;
  }

  closeTeamDialog(): void {
    if (this.converting) return;
    this.teamDialogOpen = false;
    this.teamDepartment = null;
  }

  convertToTeam(): void {
    if (!this.teamDepartment || !this.teamForm.leader_id || !this.teamForm.supervisor_id || this.converting) return;
    this.converting = true;
    this.error = '';
    this.api.convertDepartmentToTeam(this.teamDepartment.id, {
      leader_id: Number(this.teamForm.leader_id),
      supervisor_id: Number(this.teamForm.supervisor_id),
    }).subscribe({
      next: response => {
        this.applyResponse(response.organization || response);
        this.notice = `Grupa „${this.teamDepartment?.name || ''}” este acum sincronizată cu Echipe permanente.`;
        this.converting = false;
        this.teamDialogOpen = false;
        this.teamDepartment = null;
      },
      error: error => {
        this.converting = false;
        const details = error?.error?.details;
        this.error = details ? this.formatDetails(details) : error?.error?.error || 'Echipa permanentă nu a putut fi creată.';
      },
    });
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.department_id || this.saving) return;
    this.saving = true;
    this.error = '';
    const payload = {
      ...this.form,
      name: this.form.name.trim(),
      role: this.form.role.trim(),
    };
    const request = this.editingMemberId
      ? this.api.updateMember(this.editingMemberId, payload)
      : this.api.addMember(payload);
    request.subscribe({
      next: response => {
        this.applyResponse(response.organization || response);
        this.saving = false;
        this.dialogOpen = false;
      },
      error: error => {
        this.saving = false;
        const details = error?.error?.details;
        this.error = typeof details === 'string'
          ? details
          : error?.error?.error || 'Modificarea nu a putut fi salvată.';
      },
    });
  }

  openEmployee(member: OrganizationMember): void {
    if (member.employee?.id) {
      this.router.navigate(['/pontaj/fisa-angajat', member.employee.id]);
    }
  }

  memberVisible(member: OrganizationMember): boolean {
    const query = this.normalize(this.search);
    if (!query) return true;
    return this.normalize(`${member.name} ${member.role} ${member.employee?.serie || ''}`).includes(query);
  }

  departmentVisible(department: OrganizationDepartment): boolean {
    const query = this.normalize(this.search);
    if (!query) return true;
    if (this.normalize(`${department.name} ${department.subtitle}`).includes(query)) return true;
    if (department.members.some(member => this.memberVisible(member))) return true;
    return department.children.some(child => this.departmentVisible(child));
  }

  visibleMembers(department: OrganizationDepartment): OrganizationMember[] {
    return department.members.filter(member => this.memberVisible(member));
  }

  availableEmployees(): OrganizationEmployee[] {
    const currentId = this.form.employee_id;
    const occupied = new Set(
      this.members
        .filter(member => member.id !== this.editingMemberId && member.employee?.id)
        .map(member => Number(member.employee!.id))
    );
    return this.employees.filter(employee => employee.id === currentId || !occupied.has(employee.id));
  }

  availableSuperiors(): OrganizationMember[] {
    return this.members.filter(member => member.id !== this.editingMemberId);
  }

  superiorName(identifier: number | null): string {
    return identifier ? this.members.find(member => member.id === identifier)?.name || '' : '';
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || '?';
  }

  markPhotoFailed(memberId: number): void {
    this.failedPhotos.add(memberId);
  }

  toggleDepartment(department: OrganizationDepartment): void {
    if (this.collapsedDepartments.has(department.id)) {
      this.collapsedDepartments.delete(department.id);
      return;
    }
    this.collapseDepartmentTree(department);
  }

  isDepartmentCollapsed(departmentId: number): boolean {
    return this.collapsedDepartments.has(departmentId);
  }

  trackDepartment(_: number, item: OrganizationDepartment): number { return item.id; }
  trackMember(_: number, item: OrganizationMember): number { return item.id; }

  private collapseDepartmentTree(department: OrganizationDepartment): void {
    this.collapsedDepartments.add(department.id);
    department.children.forEach(child => this.collapseDepartmentTree(child));
  }

  private applyResponse(response: OrganizationResponse): void {
    this.roots = response.roots || [];
    this.departments = response.departments || [];
    this.members = response.members || [];
    this.employees = response.employees || [];
    this.summary = response.summary || this.summary;
    this.canManage = response.can_manage !== false;
    this.departmentLabels.clear();
    const walk = (department: OrganizationDepartment, parents: string[]) => {
      const path = [...parents, department.name];
      this.departmentLabels.set(department.id, path.join(' › '));
      department.children.forEach(child => walk(child, path));
    };
    this.roots.forEach(root => walk(root, []));
  }

  private emptyForm() {
    return {
      name: '', role: '', department_id: null as number | null,
      reports_to_id: null as number | null, employee_id: null as number | null,
      sort_order: null as number | null,
    };
  }

  private normalize(value: any): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro-RO').trim();
  }

  private formatDetails(details: any): string {
    if (typeof details === 'string') return details;
    if (Array.isArray(details)) return details.join(' ');
    if (details && typeof details === 'object') {
      return Object.values(details).flat().join(' ');
    }
    return 'Datele introduse nu sunt valide.';
  }
}
