import { Component, OnInit } from '@angular/core';
import { SharedService } from '../../shared.service';

type AccommodationRoom = {
  id: number;
  position: number;
  name: string;
  employee_count: number;
};

type Accommodation = {
  id: number;
  name: string;
  address: string;
  notes: string;
  active: boolean;
  employee_count: number;
  total_places: number;
  number_of_rooms: number;
  available_places: number | null;
  rooms: AccommodationRoom[];
};

type AccommodationEmployee = {
  id: number;
  name: string;
  serie: string;
  trade: string;
  company: string;
  accommodation_id: number | null;
  accommodation_room_id: number | null;
  accommodation_room_name: string;
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
  roomAssignments: Record<number, number | null> = {};
  savingEmployee: Record<number, boolean> = {};
  savedEmployee: Record<number, boolean> = {};
  searchTerm = '';
  loading = false;
  saving = false;
  error = '';
  notice = '';
  showForm = false;
  editingAccommodationId: number | null = null;
  form = {
    name: '',
    address: '',
    notes: '',
    total_places: 0,
    number_of_rooms: 0,
    rooms: [] as string[],
    active: true,
  };

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

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getAccommodations().subscribe({
      next: response => {
        this.accommodations = (response.accommodations || []).map((item: Accommodation) => ({
          ...item,
          id: Number(item.id),
          rooms: (item.rooms || []).map(room => ({ ...room, id: Number(room.id) })),
        }));
        this.employees = (response.employees || []).map((employee: AccommodationEmployee) => ({
          ...employee,
          id: Number(employee.id),
          accommodation_id: this.nullableNumber(employee.accommodation_id),
          accommodation_room_id: this.nullableNumber(employee.accommodation_room_id),
        }));
        this.assignments = this.employees.reduce((map, employee) => {
          map[employee.id] = employee.accommodation_id;
          return map;
        }, {} as Record<number, number | null>);
        this.roomAssignments = this.employees.reduce((map, employee) => {
          map[employee.id] = employee.accommodation_room_id;
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
    const totalPlaces = Math.max(0, Math.trunc(Number(this.form.total_places) || 0));
    const numberOfRooms = Math.max(0, Math.trunc(Number(this.form.number_of_rooms) || 0));
    if (totalPlaces && totalPlaces < this.currentAccommodationEmployeeCount) {
      this.error = `Cazarea are deja ${this.currentAccommodationEmployeeCount} angajați atribuiți.`;
      return;
    }
    this.syncRoomInputs(numberOfRooms);
    this.saving = true;
    this.error = '';
    const payload = {
      ...this.form,
      ...(this.editingAccommodationId ? { id: this.editingAccommodationId } : {}),
      name,
      total_places: totalPlaces,
      number_of_rooms: numberOfRooms,
      rooms: this.form.rooms.map((roomName, index) => ({
        position: index + 1,
        name: roomName.trim() || `Camera ${index + 1}`,
      })),
    };
    const wasEditing = Boolean(this.editingAccommodationId);
    const request = this.editingAccommodationId
      ? this.api.updateAccommodation(payload)
      : this.api.addAccommodation(payload);
    request.subscribe({
      next: () => {
        this.saving = false;
        this.cancelAccommodationForm();
        this.notice = wasEditing ? 'Cazarea a fost actualizată.' : 'Cazarea a fost adăugată.';
        this.load();
      },
      error: error => {
        this.saving = false;
        this.error = error?.error?.error || 'Cazarea nu a putut fi salvată.';
      },
    });
  }

  openNewAccommodation(): void {
    this.editingAccommodationId = null;
    this.form = { name: '', address: '', notes: '', total_places: 0, number_of_rooms: 0, rooms: [], active: true };
    this.showForm = true;
    this.error = '';
  }

  editAccommodation(item: Accommodation): void {
    this.editingAccommodationId = item.id;
    this.form = {
      name: item.name,
      address: item.address || '',
      notes: item.notes || '',
      total_places: item.total_places || 0,
      number_of_rooms: item.number_of_rooms || 0,
      rooms: [...(item.rooms || [])].sort((a, b) => a.position - b.position).map(room => room.name),
      active: item.active,
    };
    this.syncRoomInputs(this.form.number_of_rooms);
    this.showForm = true;
    this.error = '';
  }

  cancelAccommodationForm(): void {
    this.showForm = false;
    this.editingAccommodationId = null;
    this.form = { name: '', address: '', notes: '', total_places: 0, number_of_rooms: 0, rooms: [], active: true };
  }

  onRoomCountChange(value: number | string): void {
    const count = Math.max(0, Math.trunc(Number(value) || 0));
    this.form.number_of_rooms = count;
    this.syncRoomInputs(count);
  }

  onAccommodationChange(employee: AccommodationEmployee, value: number | null): void {
    const accommodationId = this.nullableNumber(value);
    this.assignments[employee.id] = accommodationId;
    this.roomAssignments[employee.id] = null;
    this.savedEmployee[employee.id] = false;
    if (accommodationId && this.roomsForAccommodation(accommodationId).length) {
      return;
    }
    this.persistAssignment(employee, accommodationId, null);
  }

  onRoomChange(employee: AccommodationEmployee, value: number | null): void {
    const roomId = this.nullableNumber(value);
    this.roomAssignments[employee.id] = roomId;
    const accommodationId = this.assignments[employee.id] ?? null;
    if (!accommodationId || !roomId) return;
    this.persistAssignment(employee, accommodationId, roomId);
  }

  roomsForEmployee(employee: AccommodationEmployee): AccommodationRoom[] {
    return this.roomsForAccommodation(this.assignments[employee.id] ?? null);
  }

  accommodationOptionsForEmployee(employee: AccommodationEmployee): Accommodation[] {
    const selectedId = this.assignments[employee.id] ?? employee.accommodation_id;
    return this.accommodations.filter(item => item.active || item.id === selectedId);
  }

  private persistAssignment(employee: AccommodationEmployee, accommodationId: number | null, roomId: number | null): void {
    this.savingEmployee[employee.id] = true;
    this.savedEmployee[employee.id] = false;
    this.error = '';
    this.api.assignAccommodation(employee.id, accommodationId, roomId).subscribe({
      next: response => {
        const updated = response.employee;
        employee.accommodation_id = updated.accommodation_id;
        employee.accommodation_room_id = updated.accommodation_room_id;
        employee.accommodation_room_name = updated.accommodation_room_name;
        employee.housing_location = updated.housing_location;
        this.assignments[employee.id] = updated.accommodation_id;
        this.roomAssignments[employee.id] = updated.accommodation_room_id;
        this.savingEmployee[employee.id] = false;
        this.savedEmployee[employee.id] = true;
        this.refreshCounts();
      },
      error: error => {
        this.assignments[employee.id] = employee.accommodation_id;
        this.roomAssignments[employee.id] = employee.accommodation_room_id;
        this.savingEmployee[employee.id] = false;
        this.error = error?.error?.error || `Cazarea lui ${employee.name} nu a putut fi actualizată.`;
      },
    });
  }

  get currentAccommodationEmployeeCount(): number {
    if (!this.editingAccommodationId) return 0;
    return this.accommodations.find(item => item.id === this.editingAccommodationId)?.employee_count ?? 0;
  }

  get totalConfiguredPlaces(): number {
    return this.activeAccommodations.reduce((sum, item) => sum + Number(item.total_places || 0), 0);
  }

  get totalAvailablePlaces(): number {
    return this.activeAccommodations.reduce((sum, item) => sum + this.availablePlaces(item), 0);
  }

  availablePlaces(item: Accommodation): number {
    return Math.max(0, Number(item.total_places || 0) - Number(item.employee_count || 0));
  }

  private roomsForAccommodation(accommodationId: number | null): AccommodationRoom[] {
    if (!accommodationId) return [];
    return this.accommodations.find(item => item.id === accommodationId)?.rooms ?? [];
  }

  private syncRoomInputs(count: number): void {
    const current = [...this.form.rooms];
    this.form.rooms = Array.from({ length: count }, (_, index) => current[index] || `Camera ${index + 1}`);
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  private refreshCounts(): void {
    this.accommodations.forEach(item => {
      item.employee_count = this.employees.filter(employee => employee.accommodation_id === item.id).length;
      item.available_places = item.total_places ? Math.max(0, item.total_places - item.employee_count) : null;
      item.rooms.forEach(room => {
        room.employee_count = this.employees.filter(employee => employee.accommodation_room_id === room.id).length;
      });
    });
  }

  private normalize(value: string): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private nullableNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
