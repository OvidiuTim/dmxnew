import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SharedService } from '../shared.service';

type FleetTab = 'overview' | 'equipment' | 'expirations' | 'responsibles' | 'sessions' | 'defects' | 'reports';

@Component({
  selector: 'app-fleet-admin',
  templateUrl: './fleet-admin.component.html',
  styleUrls: ['./fleet-admin.component.css']
})
export class FleetAdminComponent implements OnInit {
  tab: FleetTab = 'overview';
  createMode = false;
  private readonly pageCopy: Record<FleetTab, { title: string; description: string }> = {
    overview: { title: 'Flotă', description: 'Starea flotei, alertele zilei și utilajele în lucru.' },
    equipment: { title: 'Utilaje', description: 'Lista utilajelor, fișele, documentele și codurile QR.' },
    expirations: { title: 'Expirări documente', description: 'Tipurile de documente, importanța lor și actele care expiră.' },
    responsibles: { title: 'Desemnează responsabili', description: 'Responsabilul de documente și responsabilul tehnic.' },
    sessions: { title: 'Utilizări', description: 'Sesiunile Iau / Predau și încercările blocate.' },
    defects: { title: 'Defecte și service', description: 'Sesizări, reparații și mentenanță planificată.' },
    reports: { title: 'Rapoarte flotă', description: 'Ore, cost de utilizare, service și combustibil.' },
  };
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
  responsibles: any[] = [];
  responsibleEmployees: any[] = [];
  responsibleEquipment: any[] = [];
  responsibleEquipmentSearch = '';
  technicalResponsible: any = null;
  technicalUsers: any[] = [];
  technicalResponsibleForm: any = { app_user_id: '' };
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
  documentTypeForm: any = { id: null, name: '', importance: 'medium', warning_days: 30, required_employee_document_type_ids: [] };
  defectForm: any = { description: '', severity: 'medie', photo: null };
  fuelForm: any = { date: '', liters: '', cost: '', counter: '' };
  maintenanceForm: any = { name: '', due_date: '', due_counter: '', notes: '' };
  recommendationForm: any = this.emptyRecommendationForm();
  responsibleForm: any = this.emptyResponsibleForm();

  constructor(public api: SharedService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    const routeTab = (this.route.snapshot.data['fleetTab'] || 'overview') as FleetTab;
    this.tab = routeTab;
    this.createMode = !!this.route.snapshot.data['createEquipment'];
    if (routeTab === 'overview') {
      this.loadOverview();
      return;
    }
    this.api.getFleetDashboard().subscribe({
      next: dashboard => {
        this.dashboard = dashboard;
        this.sites = dashboard?.sites || [];
        this.documentTypes = dashboard?.document_types || [];
        this.setTab(routeTab);
        if (this.createMode) this.openCreate();
      },
      error: error => this.fail(error),
    });
  }

  setTab(tab: FleetTab): void {
    this.tab = tab;
    this.error = '';
    if (tab === 'overview') this.loadOverview();
    if (tab === 'equipment') this.loadEquipment();
    if (tab === 'expirations') this.loadExpirations();
    if (tab === 'responsibles') this.loadResponsibles();
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

  loadResponsibles(): void {
    this.loading = true;
    forkJoin({
      documents: this.api.getFleetDocumentResponsibles(),
      technical: this.api.getFleetTechnicalResponsible(),
    }).subscribe({
      next: result => {
        this.responsibles = result.documents?.responsibles || [];
        this.responsibleEmployees = result.documents?.employees || [];
        this.responsibleEquipment = result.documents?.equipment || [];
        this.technicalResponsible = result.technical?.responsible || null;
        this.technicalUsers = result.technical?.users || [];
        this.technicalResponsibleForm.app_user_id = this.technicalResponsible?.app_user_id || '';
        this.loading = false;
      },
      error: error => this.fail(error),
    });
  }

  get filteredResponsibleEquipment(): any[] {
    const search = this.responsibleEquipmentSearch.trim().toLocaleLowerCase('ro');
    if (!search) return this.responsibleEquipment;
    return this.responsibleEquipment.filter(item =>
      `${item.code} ${item.name} ${item.registration_number || ''}`.toLocaleLowerCase('ro').includes(search)
    );
  }

  onResponsibleEmployeeChange(): void {
    const employee = this.responsibleEmployees.find(item => item.id === Number(this.responsibleForm.employee_id));
    this.responsibleForm.email = employee?.email || '';
  }

  isEmployeeAlreadyResponsible(employeeId: number): boolean {
    return this.responsibles.some(item =>
      item.employee.id === employeeId && item.id !== this.responsibleForm.id
    );
  }

  toggleResponsibleEquipment(equipmentId: number, checked: boolean): void {
    const ids = this.responsibleForm.equipment_ids as number[];
    if (checked && !ids.includes(equipmentId)) ids.push(equipmentId);
    if (!checked) this.responsibleForm.equipment_ids = ids.filter(id => id !== equipmentId);
  }

  isResponsibleEquipmentSelected(equipmentId: number): boolean {
    return this.responsibleForm.equipment_ids.includes(equipmentId);
  }

  editResponsible(item: any): void {
    this.responsibleForm = {
      id: item.id,
      employee_id: item.employee.id,
      email: item.email,
      all_equipment: !!item.all_equipment,
      equipment_ids: [...(item.equipment_ids || [])],
    };
    this.responsibleEquipmentSearch = '';
  }

  cancelResponsibleEdit(): void {
    this.responsibleForm = this.emptyResponsibleForm();
    this.responsibleEquipmentSearch = '';
  }

  saveResponsible(): void {
    if (!this.responsibleForm.employee_id || !this.responsibleForm.email?.trim() || this.saving) return;
    if (!this.responsibleForm.all_equipment && !this.responsibleForm.equipment_ids.length) {
      this.error = 'Selectează cel puțin un utilaj sau bifează „Desemnează toate utilajele”.';
      return;
    }
    this.saving = true;
    this.error = '';
    this.api.saveFleetDocumentResponsible(this.responsibleForm).subscribe({
      next: () => {
        this.saving = false;
        this.notice = this.responsibleForm.id ? 'Responsabil actualizat.' : 'Responsabil adăugat.';
        this.cancelResponsibleEdit();
        this.loadResponsibles();
      },
      error: error => { this.saving = false; this.error = this.message(error); },
    });
  }

  deleteResponsible(item: any): void {
    if (!confirm(`Elimini responsabilul ${item.employee.name}?`)) return;
    this.api.deleteFleetDocumentResponsible(item.id).subscribe({
      next: () => {
        if (this.responsibleForm.id === item.id) this.cancelResponsibleEdit();
        this.notice = 'Responsabil eliminat.';
        this.loadResponsibles();
      },
      error: error => this.error = this.message(error),
    });
  }

  saveTechnicalResponsible(): void {
    if (!this.technicalResponsibleForm.app_user_id || this.saving) return;
    this.saving = true;
    this.api.saveFleetTechnicalResponsible(this.technicalResponsibleForm).subscribe({
      next: response => {
        this.saving = false;
        this.technicalResponsible = response?.responsible || null;
        this.notice = 'Responsabilul tehnic a fost salvat.';
      },
      error: error => { this.saving = false; this.error = this.message(error); },
    });
  }

  deleteTechnicalResponsible(): void {
    if (!this.technicalResponsible || !confirm('Elimini responsabilul tehnic?')) return;
    this.api.deleteFleetTechnicalResponsible().subscribe({
      next: () => {
        this.technicalResponsible = null;
        this.technicalResponsibleForm = { app_user_id: '' };
        this.notice = 'Responsabilul tehnic a fost eliminat.';
      },
      error: error => this.error = this.message(error),
    });
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

  openCreatePage(): void { this.router.navigate(['/utilaje/adauga']); }

  closeForm(): void {
    this.formOpen = false;
    if (this.createMode) this.router.navigate(['/utilaje/lista']);
  }

  get pageTitle(): string {
    return this.createMode ? 'Adaugă utilaj' : this.pageCopy[this.tab].title;
  }

  get pageDescription(): string {
    return this.createMode
      ? 'Completează fișa utilajului și documentele obligatorii.'
      : this.pageCopy[this.tab].description;
  }

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
        else { this.formOpen = false; this.router.navigate(['/utilaje/lista']); }
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
      importance: type.importance || (type.blocking ? 'high' : 'medium'),
      warning_days: type.warning_days,
      required_employee_document_type_ids: [...(type.required_employee_document_type_ids || [])],
    };
  }

  cancelDocumentTypeEdit(): void {
    this.documentTypeForm = { id: null, name: '', importance: 'medium', warning_days: 30, required_employee_document_type_ids: [] };
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

  saveRecommendation(): void {
    if (!this.selected || !this.recommendationForm.title.trim() || this.saving) return;
    this.saving = true;
    const id = this.recommendationForm.id || undefined;
    this.api.saveFleetRecommendation({
      ...this.recommendationForm,
      equipment_id: this.selected.id,
    }, id).subscribe({
      next: () => {
        this.saving = false;
        this.notice = id ? 'Recomandarea tehnică a fost actualizată.' : 'Recomandarea tehnică a fost adăugată.';
        this.recommendationForm = this.emptyRecommendationForm();
        this.refreshSelected();
      },
      error: error => { this.saving = false; this.error = this.message(error); },
    });
  }

  editRecommendation(item: any): void {
    this.recommendationForm = {
      id: item.id,
      title: item.title,
      instructions: item.instructions,
      frequency_value: item.frequency_value,
      frequency_unit: item.frequency_unit,
      first_due_date: item.first_due_date,
      importance: item.importance,
      active: item.active,
    };
  }

  cancelRecommendationEdit(): void { this.recommendationForm = this.emptyRecommendationForm(); }

  deleteRecommendation(item: any): void {
    if (!confirm(`Dezactivezi recomandarea „${item.title}”?`)) return;
    this.api.deleteFleetRecommendation(item.id).subscribe({
      next: () => { this.notice = 'Recomandarea a fost dezactivată.'; this.refreshSelected(); },
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
  private emptyResponsibleForm(): any { return { id: null, employee_id: '', email: '', all_equipment: false, equipment_ids: [] }; }
  private emptyRecommendationForm(): any {
    return { id: null, title: '', instructions: '', frequency_value: 1, frequency_unit: 'day', first_due_date: this.todayIso(), importance: 'low', active: true };
  }
  private todayIso(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
}
