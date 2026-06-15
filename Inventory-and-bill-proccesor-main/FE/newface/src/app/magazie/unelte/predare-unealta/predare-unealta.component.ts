import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SharedService } from 'src/app/shared.service';

interface EmployeeOption {
  UserId: number;
  UserName: string;
  UserSerie?: string | null;
  Company?: string | null;
  trade?: string | null;
}

interface ToolItem {
  ToolId: number;
  ToolSerie?: string | null;
  ToolName: string;
  User?: string | null;
  IsSSM?: boolean | null;
  Status?: string | null;
  Location?: string | null;
  MainLocation?: string | null;
  Detail?: string | null;
  AssignedUserId?: number | null;
  AssignedUserName?: string | null;
  DateReceived?: string | null;
  DateOfGiving?: string | null;
  Pieces?: number | null;
}

@Component({
  selector: 'app-predare-unealta',
  templateUrl: './predare-unealta.component.html',
  styleUrls: ['../unelte.component.css', './predare-unealta.component.css']
})
export class PredareUnealtaComponent implements OnInit {
  users: EmployeeOption[] = [];
  tools: ToolItem[] = [];
  selectedUser: EmployeeOption | null = null;

  userSearchTerm = '';
  toolSearchTerm = '';
  loadingUsers = false;
  loadingTools = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;

  constructor(private router: Router, private service: SharedService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadTools();
  }

  seeMagazie(): void { this.router.navigateByUrl('/magazie'); }
  seeUnelte(): void { this.router.navigateByUrl('/unelte'); }
  seeAdaugaUnealta(): void { this.router.navigateByUrl('/unelte/adauga-unealta'); }
  seePredareUnealta(): void { this.router.navigateByUrl('/predare-unealta'); }

  get filteredUsers(): EmployeeOption[] {
    const search = this.normalize(this.userSearchTerm);
    if (!search) {
      return this.users;
    }

    return this.users.filter(user => [
      user.UserName,
      user.UserSerie,
      user.Company,
      user.trade,
    ].some(value => this.normalize(value).includes(search)));
  }

  get filteredTools(): ToolItem[] {
    const search = this.normalize(this.toolSearchTerm);
    if (!search) {
      return this.tools;
    }

    return this.tools.filter(tool => [
      tool.ToolName,
      tool.ToolSerie,
      tool.Location,
      tool.MainLocation,
      tool.AssignedUserName,
      tool.Detail,
    ].some(value => this.normalize(value).includes(search)));
  }

  loadUsers(): void {
    this.loadingUsers = true;
    this.service.getUsrList().subscribe({
      next: (users) => {
        this.users = (users ?? [])
          .map(user => ({
            UserId: Number(user.UserId),
            UserName: String(user.UserName ?? ''),
            UserSerie: user.UserSerie ?? null,
            Company: user.Company ?? null,
            trade: user.trade ?? null,
          }))
          .filter(user => Number.isFinite(user.UserId) && !!user.UserName)
          .sort((a, b) => a.UserName.localeCompare(b.UserName, 'ro'));
        this.loadingUsers = false;
      },
      error: (err) => {
        console.error('Nu pot incarca angajatii', err);
        this.error = 'Nu pot incarca lista de angajati.';
        this.loadingUsers = false;
      }
    });
  }

  loadTools(): void {
    this.loadingTools = true;
    this.service.getTolList().subscribe({
      next: (tools) => {
        this.tools = ((tools ?? []) as ToolItem[])
          .sort((a, b) => String(a.ToolName ?? '').localeCompare(String(b.ToolName ?? ''), 'ro'));
        this.loadingTools = false;
      },
      error: (err) => {
        console.error('Nu pot incarca uneltele', err);
        this.error = 'Nu pot incarca lista de unelte.';
        this.loadingTools = false;
      }
    });
  }

  selectUser(user: EmployeeOption): void {
    this.selectedUser = user;
    this.toolSearchTerm = '';
    this.error = null;
    this.success = null;
  }

  clearSelectedUser(): void {
    this.selectedUser = null;
    this.toolSearchTerm = '';
  }

  addToolForSelectedUser(): void {
    if (!this.selectedUser) {
      this.error = 'Alege un angajat inainte sa adaugi o unealta pentru el.';
      return;
    }

    this.router.navigate(['/unelte/adauga-unealta'], {
      queryParams: { user_id: this.selectedUser.UserId }
    });
  }

  assignTool(tool: ToolItem): void {
    if (!this.selectedUser) {
      this.error = 'Alege un angajat inainte sa predai unealta.';
      return;
    }

    const confirmed = confirm(`Predai "${tool.ToolName}" catre ${this.selectedUser.UserName}?`);
    if (!confirmed) {
      return;
    }

    this.saving = true;
    this.error = null;
    this.success = null;

    const payload = {
      ToolId: tool.ToolId,
      ToolSerie: tool.ToolSerie ?? null,
      ToolName: tool.ToolName,
      IsSSM: !!tool.IsSSM,
      Status: 'in_lucru',
      Location: this.selectedUser.UserName,
      MainLocation: this.selectedUser.UserName,
      Detail: tool.Detail ?? null,
      AssignedUserId: this.selectedUser.UserId,
      DateReceived: this.todayISO(),
      DateOfGiving: this.todayISO(),
      IsReturned: false,
      DateReturned: null,
      IsLost: false,
      DateLost: null,
      Pieces: tool.Pieces ?? 1,
    };

    this.service.updateTool(payload).subscribe({
      next: () => {
        const userName = this.selectedUser?.UserName ?? 'angajat';
        this.saving = false;
        this.success = `Unealta a fost predata catre ${userName}.`;
        this.selectedUser = null;
        this.toolSearchTerm = '';
        this.loadTools();
        this.router.navigateByUrl('/predare-unealta');
      },
      error: (err) => {
        console.error('Nu pot preda unealta', err);
        this.saving = false;
        this.error = err?.error?.details
          ? `Nu pot preda unealta: ${JSON.stringify(err.error.details)}`
          : 'Nu pot preda unealta acum.';
      }
    });
  }

  statusLabel(tool: ToolItem): string {
    if (tool.IsSSM) {
      return 'SSM';
    }
    return 'Santier';
  }

  holderLabel(tool: ToolItem): string {
    return tool.AssignedUserName || tool.User || tool.Location || tool.MainLocation || 'Magazie';
  }

  private normalize(value: string | number | null | undefined): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private todayISO(): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }
}
