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
  Pieces: number;
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
  private returnToPredare = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: SharedService
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const rawUserId = params.get('user_id');
    const parsedUserId = Number(rawUserId);
    this.returnToPredare = params.get('from') === 'predare';

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
    return this.todayISO();
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

    if (!Number.isFinite(Number(this.form.Pieces)) || Number(this.form.Pieces) < 1) {
      this.error = 'Numarul de bucati trebuie sa fie cel putin 1.';
      return;
    }

    this.saving = true;
    this.service.addTool(this.buildPayload()).subscribe({
      next: () => {
        this.saving = false;

        if (this.returnToPredare && this.preselectedUserId) {
          this.router.navigate(['/predare-unealta'], {
            queryParams: { user_id: this.preselectedUserId }
          });
          return;
        }

        this.router.navigateByUrl('/unelte');
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
      Pieces: Math.max(1, Math.floor(Number(this.form.Pieces) || 1)),
    };
  }

  private emptyForm(): AddToolForm {
    return {
      ToolName: '',
      ToolSerie: '',
      IsSSM: false,
      AssignedUserId: null,
      Pieces: 1,
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
