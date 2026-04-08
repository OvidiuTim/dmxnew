import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SharedService } from '../../shared.service';

@Component({
  selector: 'app-employee-form',
  templateUrl: './employee-form.component.html',
  styleUrls: ['./employee-form.component.css']
})
export class EmployeeFormComponent implements OnInit {
  isEditMode = false;
  userId: number | null = null;
  loading = false;
  saving = false;
  error: string | null = null;
  photoPreview: string | null = null;
  photoFileName = '';

  readonly form = this.fb.group({
    UserName: ['', [Validators.required, Validators.maxLength(100)]],
    UserSerie: ['', [Validators.required, Validators.maxLength(100)]],
    UserPin: ['', [Validators.required, Validators.maxLength(100)]],
    uid: ['', [Validators.maxLength(128)]],
    hourly_rate: ['23.00', [Validators.required]],
    Company: ['RNX', [Validators.maxLength(100)]],
    equipment_size: ['', [Validators.maxLength(100)]],
    received_equipment: [null as boolean | null],
    phone_number: ['', [Validators.maxLength(50)]],
    photo: [null as string | null],
    trade: ['', [Validators.maxLength(100)]],
  });

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private api: SharedService,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    if (!rawId) {
      return;
    }

    this.userId = Number(rawId);
    this.isEditMode = Number.isFinite(this.userId);
    if (this.isEditMode) {
      this.loadUser(this.userId as number);
    }
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Editeaza angajatul' : 'Adauga un angajat nou';
  }

  get pageSubtitle(): string {
    return this.isEditMode
      ? 'Actualizeaza datele angajatului si salveaza modificarile in acelasi formular.'
      : 'Completeaza datele de baza pentru angajat. Campurile optionale pot ramane necompletate.';
  }

  get receivedEquipmentValue(): string {
    const value = this.form.value.received_equipment;
    if (value === true) {
      return 'true';
    }
    if (value === false) {
      return 'false';
    }
    return '';
  }

  onReceivedEquipmentChange(value: string): void {
    if (value === 'true') {
      this.form.patchValue({ received_equipment: true });
      return;
    }

    if (value === 'false') {
      this.form.patchValue({ received_equipment: false });
      return;
    }

    this.form.patchValue({ received_equipment: null });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.error = 'Fisierul selectat trebuie sa fie o imagine.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      this.form.patchValue({ photo: result });
      this.photoPreview = result;
      this.photoFileName = file.name;
      this.error = null;
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  clearPhoto(): void {
    this.form.patchValue({ photo: null });
    this.photoPreview = null;
    this.photoFileName = '';
  }

  submit(): void {
    this.error = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Completeaza campurile obligatorii inainte sa salvezi.';
      return;
    }

    const payload = this.buildPayload();
    if (!payload.hourly_rate) {
      this.error = 'Tariful orar este invalid.';
      return;
    }

    this.saving = true;
    const request = this.isEditMode
      ? this.api.updateUser(payload)
      : this.api.addUser(payload);

    request.subscribe({
      next: (response: any) => {
        this.saving = false;
        const targetId = response?.UserId ?? payload.UserId ?? null;
        if (targetId) {
          this.router.navigate(['/user', targetId]);
          return;
        }

        this.router.navigate(['/pontaj']);
      },
      error: (err) => {
        this.saving = false;
        const details = err?.error?.details;
        if (details) {
          this.error = `Nu am putut salva angajatul. ${JSON.stringify(details)}`;
          return;
        }

        this.error = typeof err?.error?.error === 'string'
          ? err.error.error
          : 'Nu am putut salva angajatul acum. Incearca din nou.';
      }
    });
  }

  cancel(): void {
    if (this.userId) {
      this.router.navigate(['/user', this.userId]);
      return;
    }

    this.router.navigate(['/pontaj']);
  }

  private loadUser(userId: number): void {
    this.loading = true;
    this.error = null;

    this.api.getUser(userId).subscribe({
      next: (user) => {
        this.loading = false;
        this.form.patchValue({
          UserName: user?.UserName ?? '',
          UserSerie: user?.UserSerie ?? '',
          UserPin: user?.UserPin ?? '',
          uid: user?.uid ?? '',
          hourly_rate: user?.hourly_rate != null ? String(user.hourly_rate) : '23.00',
          Company: user?.Company ?? 'RNX',
          equipment_size: user?.equipment_size ?? '',
          received_equipment: user?.received_equipment ?? null,
          phone_number: user?.phone_number ?? '',
          photo: user?.photo ?? null,
          trade: user?.trade ?? '',
        });
        this.photoPreview = user?.photo ?? null;
      },
      error: () => {
        this.loading = false;
        this.error = 'Nu am putut incarca angajatul pentru editare.';
      }
    });
  }

  private buildPayload(): any {
    const value = this.form.getRawValue();

    return {
      ...(this.userId ? { UserId: this.userId } : {}),
      UserName: (value.UserName ?? '').trim(),
      UserSerie: (value.UserSerie ?? '').trim(),
      UserPin: (value.UserPin ?? '').trim(),
      uid: this.normalizeOptionalString(value.uid),
      hourly_rate: this.normalizeRate(value.hourly_rate),
      Company: this.normalizeOptionalString(value.Company),
      NameAndSerie: null,
      equipment_size: this.normalizeOptionalString(value.equipment_size),
      received_equipment: value.received_equipment,
      phone_number: this.normalizeOptionalString(value.phone_number),
      photo: value.photo || null,
      trade: this.normalizeOptionalString(value.trade),
    };
  }

  private normalizeOptionalString(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim();
    return normalized ? normalized : null;
  }

  private normalizeRate(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim().replace(',', '.');
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return parsed.toFixed(2);
  }
}
