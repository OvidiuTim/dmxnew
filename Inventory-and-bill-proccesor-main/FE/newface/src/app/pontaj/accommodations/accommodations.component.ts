import { Component, OnInit } from '@angular/core';
import { SharedService } from '../../shared.service';

type Accommodation = {
  id: number;
  name: string;
  address: string;
  notes: string;
  active: boolean;
  employee_count: number;
};

type AccommodationEmployee = {
  id: number;
  name: string;
  serie: string;
  trade: string;
  company: string;
  accommodation_id: number | null;
  housing_location: string;
};

@Component({
  selector: 'app-accommodations',
  templateUrl: './accommodations.component.html',
  styleUrls: ['./accommodations.component.css'],
})
export class AccommodationsComponent implements OnInit {
  accommodations: Accommodation[] = [];
  employees: AccommodationEmployee[] = [];
  assignments: Record<number, number | null> = {};
  savingEmployee: Record<number, boolean> = {};
  savedEmployee: Record<number, boolean> = {};
  searchTerm = '';
  loading = false;
  saving = false;
  error = '';
  notice = '';
  showForm = false;
  form = { name: '', address: '', notes: '' };

  constructor(private api: SharedService) {}

  ngOnInit(): void {
    this.load();
  }

  get activeAccommodations(): Accommodation[] {
    return this.accommodations.filter(item => item.active);
  }

  get filteredEmployees(): AccommodationEmployee[] {
    const search = this.normalize(this.searchTerm);
    if (!search) return this.employees;
    return this.employees.filter(employee => this.normalize(
      `${employee.name} ${employee.serie} ${employee.trade} ${employee.company} ${employee.housing_location}`
    ).includes(search));
  }

  get unassignedCount(): number {
    return this.employees.filter(employee => !employee.accommodation_id).length;
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getAccommodations().subscribe({
      next: response => {
        this.accommodations = response.accommodations || [];
        this.employees = response.employees || [];
        this.assignments = this.employees.reduce((map, employee) => {
          map[employee.id] = employee.accommodation_id;
          return map;
        }, {} as Record<number, number | null>);
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.error = error?.error?.error || 'Cazările nu au putut fi încărcate.';
      },
    });
  }

  saveAccommodation(): void {
    const name = this.form.name.trim();
    if (!name) {
      this.error = 'Completează denumirea cazării.';
      return;
    }
    this.saving = true;
    this.error = '';
    this.api.addAccommodation({ ...this.form, name }).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.form = { name: '', address: '', notes: '' };
        this.notice = 'Cazarea a fost adăugată.';
        this.load();
      },
      error: error => {
        this.saving = false;
        this.error = error?.error?.error || 'Cazarea nu a putut fi salvată.';
      },
    });
  }

  assign(employee: AccommodationEmployee, value: string): void {
    const accommodationId = value ? Number(value) : null;
    this.assignments[employee.id] = accommodationId;
    this.savingEmployee[employee.id] = true;
    this.savedEmployee[employee.id] = false;
    this.error = '';
    this.api.assignAccommodation(employee.id, accommodationId).subscribe({
      next: response => {
        const updated = response.employee;
        employee.accommodation_id = updated.accommodation_id;
        employee.housing_location = updated.housing_location;
        this.savingEmployee[employee.id] = false;
        this.savedEmployee[employee.id] = true;
        this.refreshCounts();
      },
      error: error => {
        this.assignments[employee.id] = employee.accommodation_id;
        this.savingEmployee[employee.id] = false;
        this.error = error?.error?.error || `Cazarea lui ${employee.name} nu a putut fi actualizată.`;
      },
    });
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  private refreshCounts(): void {
    this.accommodations.forEach(item => {
      item.employee_count = this.employees.filter(employee => employee.accommodation_id === item.id).length;
    });
  }

  private normalize(value: string): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
}
