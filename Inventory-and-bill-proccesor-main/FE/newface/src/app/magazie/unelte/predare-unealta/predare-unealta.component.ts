import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  DisplaySerie?: string | null;
  SerialNumber?: string | null;
  serial?: string | null;
  serial_number?: string | null;
  cod_serie?: string | null;
  toolSerial?: string | null;
  ToolName: string;
  BatchId?: string | null;
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
  IsReturned?: boolean | null;
  IsLost?: boolean | null;
  DateReturned?: string | null;
  DateLost?: string | null;
  Pieces?: number | null;
}

type HandoverTab = 'predare' | 'preluare';
type ReturnStatus = 'magazie' | 'stricata';

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
  activeTab: HandoverTab = 'predare';
  returnStatus: ReturnStatus = 'magazie';
  loadingUsers = false;
  loadingTools = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;
  quantities: Record<number, number> = {};
  private preselectedUserId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: SharedService
  ) {}

  ngOnInit(): void {
    const rawUserId = this.route.snapshot.queryParamMap.get('user_id');
    const parsedUserId = Number(rawUserId);
    if (rawUserId && Number.isFinite(parsedUserId)) {
      this.preselectedUserId = parsedUserId;
    }

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

  get availableTools(): ToolItem[] {
    return this.tools.filter(tool => this.isWarehouseTool(tool));
  }

  get employeeTools(): ToolItem[] {
    if (!this.selectedUser) {
      return [];
    }

    return this.tools.filter(tool => this.isToolAssignedToSelectedUser(tool));
  }

  get activeTools(): ToolItem[] {
    return this.activeTab === 'predare' ? this.availableTools : this.employeeTools;
  }

  get filteredTools(): ToolItem[] {
    const search = this.normalize(this.toolSearchTerm);
    const tools = this.activeTools;
    if (!search) {
      return tools;
    }

    return tools.filter(tool => [
      tool.ToolName,
      this.displayToolSerie(tool),
      tool.ToolSerie,
      tool.DisplaySerie,
      tool.SerialNumber,
      tool.serial,
      tool.serial_number,
      tool.cod_serie,
      tool.toolSerial,
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

        const preselectedUser = this.preselectedUserId
          ? this.users.find(user => user.UserId === this.preselectedUserId)
          : null;
        if (preselectedUser) {
          this.selectUser(preselectedUser);
          this.activeTab = 'predare';
        }

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
    this.activeTab = 'predare';
  }

  selectTab(tab: HandoverTab): void {
    this.activeTab = tab;
    this.toolSearchTerm = '';
    this.error = null;
    this.success = null;
  }

  addToolForSelectedUser(): void {
    if (!this.selectedUser) {
      this.error = 'Alege un angajat inainte sa adaugi o unealta pentru el.';
      return;
    }

    this.router.navigate(['/unelte/adauga-unealta'], {
      queryParams: { user_id: this.selectedUser.UserId, from: 'predare' }
    });
  }

  assignTool(tool: ToolItem): void {
    if (!this.selectedUser) {
      this.error = 'Alege un angajat inainte sa predai unealta.';
      return;
    }

    const pieces = this.piecesCount(tool);
    if (pieces < 1) {
      this.error = 'Unealta nu are stoc disponibil in magazie.';
      return;
    }

    const quantity = this.quantityFor(tool);
    const confirmed = confirm(`Predai ${quantity} ${quantity === 1 ? 'bucata' : 'bucati'} din "${tool.ToolName}" catre ${this.selectedUser.UserName}?`);
    if (!confirmed) {
      return;
    }

    this.saving = true;
    this.error = null;
    this.success = null;

    this.service.assignToolQuantity({
      ToolId: tool.ToolId,
      AssignedUserId: this.selectedUser.UserId,
      Pieces: quantity,
    }).subscribe({
      next: () => {
        const userName = this.selectedUser?.UserName ?? 'angajat';
        this.saving = false;
        this.success = `Au fost predate ${quantity} ${quantity === 1 ? 'bucata' : 'bucati'} catre ${userName}.`;
        this.toolSearchTerm = '';
        delete this.quantities[tool.ToolId];
        this.loadTools();
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

  receiveTool(tool: ToolItem): void {
    if (!this.selectedUser) {
      this.error = 'Alege un angajat inainte sa preiei unealta.';
      return;
    }

    const statusLabel = this.returnStatus === 'stricata' ? 'stricata' : 'functionala';
    const quantity = this.quantityFor(tool);
    const confirmed = confirm(`Preiei ${quantity} ${quantity === 1 ? 'bucata' : 'bucati'} din "${tool.ToolName}" de la ${this.selectedUser.UserName} ca unealta ${statusLabel}?`);
    if (!confirmed) {
      return;
    }

    this.saving = true;
    this.error = null;
    this.success = null;

    this.service.returnToolQuantity({
      ToolId: tool.ToolId,
      Pieces: quantity,
      Status: this.returnStatus,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.success = this.returnStatus === 'stricata'
          ? `Au fost preluate ${quantity} ${quantity === 1 ? 'bucata' : 'bucati'} in magazie ca stricate.`
          : `Au fost preluate ${quantity} ${quantity === 1 ? 'bucata' : 'bucati'} in magazie ca functionale.`;
        this.toolSearchTerm = '';
        delete this.quantities[tool.ToolId];
        this.loadTools();
      },
      error: (err) => {
        console.error('Nu pot prelua unealta', err);
        this.saving = false;
        this.error = err?.error?.details
          ? `Nu pot prelua unealta: ${JSON.stringify(err.error.details)}`
          : 'Nu pot prelua unealta acum.';
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

  displayToolSerie(tool: ToolItem): string {
    return this.serieCandidates(tool).find(value => value.length > 0) || 'Fara serie';
  }

  private isWarehouseTool(tool: ToolItem): boolean {
    const status = this.normalize(tool.Status);
    return !tool.IsLost && status === 'magazie' && this.piecesCount(tool) > 0;
  }

  private isToolAssignedToSelectedUser(tool: ToolItem): boolean {
    if (!this.selectedUser || tool.IsReturned || tool.IsLost) {
      return false;
    }

    const userIdMatches = Number(tool.AssignedUserId) === this.selectedUser.UserId;
    const userName = this.normalize(this.selectedUser.UserName);
    const userNameMatches = [
      tool.AssignedUserName,
      tool.User,
      tool.Location,
      tool.MainLocation,
    ].some(value => this.normalize(value) === userName);

    return (userIdMatches || userNameMatches) && this.normalize(tool.Status) === 'in_lucru';
  }

  private normalize(value: string | number | null | undefined): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private serieCandidates(tool: ToolItem): string[] {
    return [
      tool.ToolSerie,
      tool.DisplaySerie,
      tool.SerialNumber,
      tool.serial,
      tool.serial_number,
      tool.cod_serie,
      tool.toolSerial,
    ].map(value => String(value ?? '').trim());
  }

  piecesCount(tool: Pick<ToolItem, 'Pieces'> | null | undefined): number {
    if (tool?.Pieces === null || tool?.Pieces === undefined) {
      return 1;
    }
    const pieces = Number(tool.Pieces);
    return Number.isFinite(pieces) ? Math.max(0, Math.floor(pieces)) : 1;
  }

  quantityFor(tool: ToolItem): number {
    return this.clampQuantity(tool, this.quantities[tool.ToolId] ?? 1);
  }

  setToolQuantity(tool: ToolItem, value: string | number | null): void {
    this.quantities[tool.ToolId] = this.clampQuantity(tool, value);
  }

  private clampQuantity(tool: ToolItem, value: string | number | null | undefined): number {
    const max = Math.max(1, this.piecesCount(tool));
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 1;
    }
    return Math.min(max, Math.max(1, Math.floor(parsed)));
  }

  private todayISO(): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }
}
