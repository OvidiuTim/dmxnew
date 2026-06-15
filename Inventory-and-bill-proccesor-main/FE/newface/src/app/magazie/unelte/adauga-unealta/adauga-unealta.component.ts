import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SharedService } from 'src/app/shared.service';

interface EmployeeOption {
  UserId: number;
  UserName: string;
}

interface AddToolForm {
  ToolName: string;
  ToolSerie: string;
  IsSSM: boolean;
  AssignedUserId: number | null;
  Detail: string;
}

@Component({
  selector: 'app-adauga-unealta',
  templateUrl: './adauga-unealta.component.html',
  styleUrls: ['../unelte.component.css', './adauga-unealta.component.css']
})
export class AdaugaUnealtaComponent implements OnInit {
  users: EmployeeOption[] = [];
  form: AddToolForm = this.emptyForm();

  loadingUsers = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;
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
      this.form.AssignedUserId = parsedUserId;
    }

    this.loadUsers();
  }

  seeMagazie(): void { this.router.navigateByUrl('/magazie'); }
  seeUnelte(): void { this.router.navigateByUrl('/unelte'); }
  seeAdaugaUnealta(): void { this.router.navigateByUrl('/unelte/adauga-unealta'); }
  seePredareUnealta(): void { this.router.navigateByUrl('/predare-unealta'); }

  get assignedUser(): EmployeeOption | null {
    return this.users.find(user => user.UserId === this.form.AssignedUserId) ?? null;
  }

  get computedStatus(): 'magazie' | 'in_lucru' {
    return this.assignedUser ? 'in_lucru' : 'magazie';
  }

  get computedStatusLabel(): string {
    return this.assignedUser ? 'In lucru' : 'In magazie';
  }

  get computedLocation(): string {
    return this.assignedUser?.UserName ?? 'Magazie';
  }

  get computedDateReceived(): string | null {
    return this.assignedUser ? this.todayISO() : null;
  }

  loadUsers(): void {
    this.loadingUsers = true;
    this.service.getUsrList().subscribe({
      next: (users) => {
        this.users = (users ?? [])
          .map(user => ({ UserId: Number(user.UserId), UserName: String(user.UserName ?? '') }))
          .filter(user => Number.isFinite(user.UserId) && !!user.UserName)
          .sort((a, b) => a.UserName.localeCompare(b.UserName, 'ro'));

        if (this.preselectedUserId && this.users.some(user => user.UserId === this.preselectedUserId)) {
          this.form.AssignedUserId = this.preselectedUserId;
        }

        this.loadingUsers = false;
      },
      error: (err) => {
        console.error('Nu pot incarca angajatii', err);
        this.users = [];
        this.loadingUsers = false;
      }
    });
  }

  saveTool(): void {
    this.error = null;
    this.success = null;

    if (!this.form.ToolName.trim()) {
      this.error = 'Completeaza numele uneltei.';
      return;
    }

    this.saving = true;
    this.service.addTool(this.buildPayload()).subscribe({
      next: () => {
        this.saving = false;
        this.success = 'Unealta a fost adaugata.';
        this.form = this.emptyForm();
        if (this.preselectedUserId) {
          this.form.AssignedUserId = this.preselectedUserId;
        }
      },
      error: (err) => {
        console.error('Nu pot adauga unealta', err);
        this.saving = false;
        this.error = err?.error?.details
          ? `Nu pot adauga unealta: ${JSON.stringify(err.error.details)}`
          : 'Nu pot adauga unealta acum.';
      }
    });
  }

  private buildPayload(): any {
    return {
      ToolSerie: this.normalizeOptional(this.form.ToolSerie),
      ToolName: this.form.ToolName.trim(),
      IsSSM: this.form.IsSSM,
      Status: this.computedStatus,
      Location: this.computedLocation,
      MainLocation: this.computedLocation,
      Detail: this.normalizeOptional(this.form.Detail),
      AssignedUserId: this.form.AssignedUserId,
      DateReceived: this.computedDateReceived,
      DateOfGiving: this.computedDateReceived,
      IsReturned: false,
      DateReturned: null,
      IsLost: false,
      DateLost: null,
      Pieces: 1,
    };
  }

  private emptyForm(): AddToolForm {
    return {
      ToolName: '',
      ToolSerie: '',
      IsSSM: false,
      AssignedUserId: null,
      Detail: '',
    };
  }

  private normalizeOptional(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim();
    return normalized ? normalized : null;
  }

  private todayISO(): string {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }
}
