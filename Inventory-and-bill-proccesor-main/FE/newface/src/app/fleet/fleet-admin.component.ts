import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { SharedService } from '../shared.service';

type FleetTab = 'overview' | 'equipment' | 'expirations' | 'sessions' | 'defects' | 'reports';

@Component({
  selector: 'app-fleet-admin',
  templateUrl: './fleet-admin.component.html',
  styleUrls: ['./fleet-admin.component.css']
})
export class FleetAdminComponent implements OnInit {
  tab: FleetTab = 'overview';
  tabs: Array<{ key: FleetTab; label: string; icon: string }> = [
    { key: 'overview', label: 'Flotă', icon: 'space_dashboard' },
    { key: 'equipment', label: 'Utilaje', icon: 'local_shipping' },
    { key: 'expirations', label: 'Expirări documente', icon: 'event_upcoming' },
    { key: 'sessions', label: 'Utilizări', icon: 'history' },
    { key: 'defects', label: 'Defecte și service', icon: 'build' },
    { key: 'reports', label: 'Rapoarte flotă', icon: 'bar_chart' },
  ];
  dashboard: any = null;
  equipment: any[] = [];
  expirations: any[] = [];
  authorizationExpirations: any[] = [];
  sessions: any[] = [];
  blockedAttempts: any[] = [];
  defects: any[] = [];
  maintenance: any[] = [];
  reports: any = null;
  sites: any[] = [];
  documentTypes: any[] = [];
  employeeDocumentTypes: any[] = [];
  selected: any = null;
  detailTab = 'details';
  loading = false;
  saving = false;
  error = '';
  notice = '';
  filters = { q: '', category: '', state: '', site: '', problems: false, start: '', end: '' };
  formOpen = false;
  form: any = this.emptyEquipmentForm();
  documentForm: any = { type_id: '', expiry_date: '', file: null };
  documentTypeForm: any = { id: null, name: '', blocking: false, warning_days: 30, required_employee_document_type_ids: [] };
  defectForm: any = { description: '', severity: 'medie', photo: null };
  fuelForm: any = { date: '', liters: '', cost: '', counter: '' };
  maintenanceForm: any = { name: '', due_date: '', due_counter: '', notes: '' };

  constructor(public api: SharedService) {}

  ngOnInit(): void { this.loadOverview(); }

  setTab(tab: FleetTab): void {
    this.tab = tab;
    this.error = '';
    if (tab === 'overview') this.loadOverview();
    if (tab === 'equipment') this.loadEquipment();
    if (tab === 'expirations') this.loadExpirations();
    if (tab === 'sessions') this.loadSessions();
    if (tab === 'defects') this.loadDefects();
    if (tab === 'reports') this.loadReports();
  }

  loadOverview(): void {
    this.loading = true;
    forkJoin({ dashboard: this.api.getFleetDashboard(), equipment: this.api.getFleetEquipment() }).subscribe({
      next: result => {
        this.dashboard = result.dashboard;
        this.equipment = result.equipment?.equipment || [];
        this.sites = this.dashboard?.sites || [];
        this.documentTypes = this.dashboard?.document_types || [];
        this.loading = false;
      },
      error: error => this.fail(error),
    });
  }

  loadEquipment(): void {
    this.loading = true;
    const params: any = {};
    Object.entries(this.filters).forEach(([key, value]) => {
      if (['q', 'category', 'state', 'site'].includes(key) && value) params[key] = value;
    });
    if (this.filters.problems) params.problems = '1';
    this.api.getFleetEquipmentFiltered(params).subscribe({
      next: result => { this.equipment = result?.equipment || []; this.loading = false; },
      error: error => this.fail(error),
    });
  }

  loadExpirations(): void {
    this.loading = true;
    forkJoin({ expirations: this.api.getFleetExpirations(), types: this.api.getFleetDocumentTypes() }).subscribe({ next: result => { this.expirations = result.expirations?.rows || []; this.authorizationExpirations = result.expirations?.authorizations || []; this.documentTypes = result.types?.types || []; this.employeeDocumentTypes = result.types?.employee_document_types || []; this.loading = false; }, error: error => this.fail(error) });
  }

  loadSessions(): void {
    this.loading = true;
    this.api.getFleetSessions({ start: this.filters.start, end: this.filters.end, site: this.filters.site }).subscribe({ next: result => { this.sessions = result?.sessions || []; this.blockedAttempts = result?.blocked_attempts || []; this.loading = false; }, error: error => this.fail(error) });
  }

  loadDefects(): void {
    this.loading = true;
    forkJoin({ defects: this.api.getFleetDefects(), maintenance: this.api.getFleetMaintenance() }).subscribe({ next: result => { this.defects = result.defects?.defects || []; this.maintenance = result.maintenance?.maintenance || []; this.loading = false; }, error: error => this.fail(error) });
  }

  loadReports(): void {
    this.loading = true;
    this.api.getFleetReports({ start: this.filters.start, end: this.filters.end, site: this.filters.site }).subscribe({ next: result => { this.reports = result; this.loading = false; }, error: error => this.fail(error) });
  }

  openCreate(): void { this.form = this.emptyEquipmentForm(); this.formOpen = true; }

  openEdit(item: any): void {
    this.loading = true;
    this.api.getFleetEquipmentAdmin(item.id).subscribe({
      next: result => {
        this.selected = result?.equipment;
        this.form = {
          id: this.selected.id, code: this.selected.code, name: this.selected.name,
          registration_number: this.selected.registration_number, chassis_series: this.selected.chassis_series,
          manufacture_year: this.selected.manufacture_year, owner: this.selected.owner,
          ownership_type: this.selected.ownership_type, internal_rate: this.selected.internal_rate,
          category: this.selected.category, counter_type: this.selected.counter_type,
          current_counter: this.selected.current_counter, state: this.selected.state,
          site_id: this.selected.site?.id || '', required_document_type_ids: this.selected.required_document_type_ids || [],
        };
        this.detailTab = 'details'; this.formOpen = true; this.loading = false;
      },
      error: error => this.fail(error),
    });
  }

  saveEquipment(): void {
    if (!this.form.code?.trim() || !this.form.name?.trim() || this.saving) return;
    this.saving = true; this.error = '';
    const request = this.form.id ? this.api.updateFleetEquipment(this.form.id, this.form) : this.api.createFleetEquipment(this.form);
    request.subscribe({
      next: result => {
        this.saving = false; this.notice = this.form.id ? 'Utilaj actualizat.' : 'Utilaj adăugat.';
        if (this.form.id) { this.selected = { ...this.selected, ...result.equipment }; this.refreshSelected(); }
        else { this.formOpen = false; this.loadEquipment(); }
      },
      error: error => { this.saving = false; this.error = this.message(error); },
    });
  }

  archive(item: any): void {
    if (!confirm(`Arhivezi utilajul ${item.code}?`)) return;
    this.api.archiveFleetEquipment(item.id).subscribe({ next: () => { this.formOpen = false; this.notice = 'Utilaj arhivat.'; this.loadEquipment(); }, error: error => this.error = this.message(error) });
  }

  saveDocument(equipmentId: number): void {
    if (!this.documentForm.type_id || !this.documentForm.file) { this.error = 'Selectează tipul și fișierul documentului.'; return; }
    const data = new FormData();
    data.append('equipment_id', String(equipmentId)); data.append('type_id', String(this.documentForm.type_id));
    data.append('expiry_date', this.documentForm.expiry_date || ''); data.append('file', this.documentForm.file);
    this.saving = true;
    this.api.saveFleetDocument(data).subscribe({ next: () => { this.saving = false; this.documentForm = { type_id: '', expiry_date: '', file: null }; this.notice = 'Document salvat.'; this.refreshSelected(); this.loadExpirations(); }, error: error => { this.saving = false; this.error = this.message(error); } });
  }

  renew(row: any): void {
    if (!row.renewDate || !row.renewFile) { this.error = 'Completează data nouă și selectează fișierul.'; return; }
    const data = new FormData();
    data.append('equipment_id', String(row.equipment_id)); data.append('type_id', String(row.type_id));
    data.append('expiry_date', row.renewDate); data.append('file', row.renewFile);
    this.api.saveFleetDocument(data).subscribe({ next: () => { this.notice = 'Document reînnoit.'; this.loadExpirations(); }, error: error => this.error = this.message(error) });
  }

  saveDocumentType(): void {
    if (!this.documentTypeForm.name.trim()) return;
    this.api.createFleetDocumentType(this.documentTypeForm).subscribe({
      next: result => {
        const type = result?.type;
        if (type) {
          const index = this.documentTypes.findIndex(item => item.id === type.id);
          if (index >= 0) this.documentTypes[index] = type; else this.documentTypes.push(type);
        }
        this.documentTypes.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
        this.cancelDocumentTypeEdit();
        this.notice = 'Tipul de document a fost salvat.';
      },
      error: error => this.error = this.message(error),
    });
  }

  editDocumentType(type: any): void {
    this.documentTypeForm = {
      id: type.id,
      name: type.name,
      blocking: !!type.blocking,
      warning_days: type.warning_days,
      required_employee_document_type_ids: [...(type.required_employee_document_type_ids || [])],
    };
  }

  cancelDocumentTypeEdit(): void {
    this.documentTypeForm = { id: null, name: '', blocking: false, warning_days: 30, required_employee_document_type_ids: [] };
  }

  toggleRequiredEmployeeDocument(typeId: number, checked: boolean): void {
    const values = this.documentTypeForm.required_employee_document_type_ids as number[];
    if (checked && !values.includes(typeId)) values.push(typeId);
    if (!checked) this.documentTypeForm.required_employee_document_type_ids = values.filter(id => id !== typeId);
  }

  saveDefect(): void {
    if (!this.selected || !this.defectForm.description.trim()) return;
    const data = new FormData(); data.append('equipment_id', String(this.selected.id));
    data.append('description', this.defectForm.description); data.append('severity', this.defectForm.severity);
    if (this.defectForm.photo) data.append('photo', this.defectForm.photo);
    this.api.createFleetDefect(data).subscribe({ next: () => { this.defectForm = { description: '', severity: 'medie', photo: null }; this.notice = 'Defect raportat.'; this.refreshSelected(); this.loadDefects(); }, error: error => this.error = this.message(error) });
  }

  moveDefect(item: any, status: string): void {
    const repairCost = status === 'rezolvat' ? prompt('Cost reparație (lei)', item.repair_cost || '0') : item.repair_cost;
    this.api.updateFleetDefect(item.id, { status, repair_cost: repairCost }).subscribe({ next: () => { this.notice = 'Sesizare actualizată.'; this.loadDefects(); if (this.selected) this.refreshSelected(); }, error: error => this.error = this.message(error) });
  }

  saveFuel(): void {
    if (!this.selected) return;
    this.api.createFleetFuel({ equipment_id: this.selected.id, ...this.fuelForm }).subscribe({ next: () => { this.notice = 'Alimentare înregistrată.'; this.fuelForm = { date: '', liters: '', cost: '', counter: '' }; this.refreshSelected(); }, error: error => this.error = this.message(error) });
  }

  saveMaintenance(): void {
    if (!this.selected || !this.maintenanceForm.name.trim()) return;
    this.api.createFleetMaintenance({ equipment_id: this.selected.id, ...this.maintenanceForm }).subscribe({
      next: () => {
        this.notice = 'Revizie planificată.';
        this.maintenanceForm = { name: '', due_date: '', due_counter: '', notes: '' };
        this.refreshSelected();
        this.loadDefects();
      },
      error: error => this.error = this.message(error),
    });
  }

  completeMaintenance(item: any): void {
    const cost = prompt('Cost revizie (lei)', item.cost || '0');
    if (cost === null) return;
    this.api.updateFleetMaintenance(item.id, { status: 'finalizata', cost }).subscribe({
      next: () => { this.notice = 'Revizie finalizată.'; this.loadDefects(); if (this.selected) this.refreshSelected(); },
      error: error => this.error = this.message(error),
    });
  }

  printQr(): void {
    const image = document.querySelector<HTMLImageElement>('.qr-print-image');
    if (!image || !this.selected) return;
    const popup = window.open('', '_blank', 'width=520,height=620');
    if (!popup) return;
    popup.document.write(`<html><head><title>${this.selected.code}</title><style>body{text-align:center;font-family:Arial;padding:40px}img{width:360px}h1{margin-bottom:4px}</style></head><body><h1>${this.selected.code}</h1><p>${this.selected.name}</p><img src="${image.src}"><script>onload=()=>print()<\/script></body></html>`);
    popup.document.close();
  }

  exportCsv(): void {
    if (!this.reports) return;
    const rows = [['Grup', 'Denumire', 'Ore', 'Cost lei']];
    for (const [group, values] of [['Utilaj', this.reports.by_equipment], ['Șantier', this.reports.by_site], ['Angajat', this.reports.by_employee]] as any[]) {
      (values || []).forEach((row: any) => rows.push([group, row.label, row.hours, row.cost]));
    }
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'raport-flota.csv'; link.click(); URL.revokeObjectURL(link.href);
  }

  documentState(item: any): string { return item.status === 'expired' || item.status === 'missing' ? 'bad' : item.status === 'warning' ? 'warn' : 'good'; }
  duration(seconds: number): string { return `${Math.floor((seconds || 0) / 3600)}h ${Math.floor(((seconds || 0) % 3600) / 60)}m`; }
  qrUrl(id: number): string { return `${window.location.origin}/api/fleet/equipment/${id}/qr.png`; }
  expiryGroups(): Array<{ key: string; label: string }> { return [{ key: 'expired', label: 'Expirate' }, { key: '7', label: 'Expiră în 7 zile' }, { key: '30', label: 'Expiră în 30 de zile' }, { key: '60', label: 'Expiră în 60 de zile' }]; }
  rowsForGroup(key: string): any[] { return this.expirations.filter(row => row.group === key); }
  authorizationsForGroup(key: string): any[] { return this.authorizationExpirations.filter(row => row.group === key); }
  defectsFor(status: string): any[] { return this.defects.filter(item => item.status === status); }
  setFile(target: any, event: Event, key = 'file'): void { target[key] = (event.target as HTMLInputElement).files?.[0] || null; }

  private refreshSelected(): void { if (this.selected?.id) this.openEdit({ id: this.selected.id }); }
  private fail(error: any): void { this.loading = false; this.error = this.message(error); }
  private message(error: any): string { return error?.error?.error || 'Datele flotei nu au putut fi actualizate.'; }
  private emptyEquipmentForm(): any { return { code: '', name: '', registration_number: '', chassis_series: '', manufacture_year: '', owner: '', ownership_type: '', internal_rate: '', category: 'autoutilitara', counter_type: 'km', current_counter: '', state: 'disponibil', site_id: '', required_document_type_ids: [] }; }
}
