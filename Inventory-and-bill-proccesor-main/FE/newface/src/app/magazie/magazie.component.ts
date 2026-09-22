import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-magazie',
  templateUrl: './magazie.component.html',
  styleUrls: ['./magazie.component.css']
})
export class MagazieComponent implements OnInit {
  counts = { employees: 0, tools: 0, materials: 0, movements: 0 };
  loading = true;
  error: string | null = null;
  storekeepers: any[] = [];
  availableStorekeepers: any[] = [];
  selectedStorekeeperId: number | null = null;
  storekeeperFormOpen = false;
  savingStorekeeper = false;
  storekeeperError: string | null = null;
  tapeRows: any[] = [];
  tapeLoading = true;
  tapeDownloading = false;
  tapeError: string | null = null;
  tapeStartDate = '';
  tapeEndDate = this.todayISO();
  tapeSearch = '';

  constructor(private router: Router, private service:SharedService) { }

  ngOnInit(): void {
    this.loadTapeReport();
    forkJoin({
      employees: this.service.getUsrList(),
      tools: this.service.getTolList(),
      materials: this.service.getMatList(),
      movements: this.service.getHisList(),
      storekeepers: this.service.getStorekeepers(),
    }).subscribe({
      next: data => {
        this.counts = {
          employees: data.employees?.length ?? 0,
          tools: data.tools?.length ?? 0,
          materials: data.materials?.length ?? 0,
          movements: data.movements?.length ?? 0,
        };
        this.applyStorekeeperData(data.storekeepers);
        this.storekeeperFormOpen = this.storekeepers.length === 0;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Rezumatul magaziei nu a putut fi încărcat.';
      }
    });
  }

  get filteredTapeRows(): any[] {
    const search = this.tapeSearch.trim().toLocaleLowerCase('ro-RO');
    if (!search) return this.tapeRows;
    return this.tapeRows.filter(item => [
      item.recipient_name,
      item.recipient_series,
      item.tool_name,
      item.tool_series,
      item.issued_by,
    ].some(value => String(value || '').toLocaleLowerCase('ro-RO').includes(search)));
  }

  get tapeRecipientCount(): number {
    return new Set(this.filteredTapeRows.map(item =>
      item.recipient_id ? `id:${item.recipient_id}` : `name:${String(item.recipient_name || '').toLocaleLowerCase('ro-RO')}`
    )).size;
  }

  get tapeQuantity(): number {
    return this.filteredTapeRows.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  }

  loadTapeReport(): void {
    if (this.tapeStartDate && this.tapeEndDate && this.tapeStartDate > this.tapeEndDate) {
      this.tapeError = 'Data de început nu poate fi după data de sfârșit.';
      return;
    }
    this.tapeLoading = true;
    this.tapeError = null;
    this.service.getTapeMeasureReport({
      start_date: this.tapeStartDate,
      end_date: this.tapeEndDate,
    }).subscribe({
      next: data => {
        this.tapeRows = data?.rows || [];
        this.tapeLoading = false;
      },
      error: response => {
        this.tapeRows = [];
        this.tapeLoading = false;
        this.tapeError = response?.error?.error || 'Raportul de rulete nu a putut fi încărcat.';
      },
    });
  }

  downloadTapeReport(): void {
    if (this.tapeDownloading) return;
    if (this.tapeStartDate && this.tapeEndDate && this.tapeStartDate > this.tapeEndDate) {
      this.tapeError = 'Data de început nu poate fi după data de sfârșit.';
      return;
    }
    this.tapeDownloading = true;
    this.tapeError = null;
    this.service.exportTapeMeasureReport({
      start_date: this.tapeStartDate,
      end_date: this.tapeEndDate,
      q: this.tapeSearch,
    }).subscribe({
      next: response => {
        const blob = response.body;
        if (!blob) {
          this.tapeDownloading = false;
          this.tapeError = 'Fișierul Excel nu a putut fi generat.';
          return;
        }
        const disposition = response.headers.get('content-disposition') || '';
        const match = disposition.match(/filename="?([^";]+)"?/i);
        const filename = match?.[1] || `raport_rulete_${this.tapeEndDate || this.todayISO()}.xlsx`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        this.tapeDownloading = false;
      },
      error: response => {
        this.tapeDownloading = false;
        this.tapeError = response?.error?.error || 'Fișierul Excel nu a putut fi descărcat.';
      },
    });
  }

  formatReportDate(value: string | null | undefined): string {
    if (!value) return 'Dată necunoscută';
    const [year, month, day] = value.split('-');
    return `${day}.${month}.${year}`;
  }

  private todayISO(): string {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
  }

  private applyStorekeeperData(data: any): void {
    this.storekeepers = data?.storekeepers || [];
    this.availableStorekeepers = data?.available_employees || [];
    if (!this.availableStorekeepers.some(employee => employee.id === this.selectedStorekeeperId)) {
      this.selectedStorekeeperId = null;
    }
  }

  openStorekeeperForm(): void {
    this.storekeeperFormOpen = true;
    this.storekeeperError = null;
  }

  addStorekeeper(): void {
    if (!this.selectedStorekeeperId || this.savingStorekeeper) return;
    this.savingStorekeeper = true;
    this.storekeeperError = null;
    this.service.addStorekeeper(this.selectedStorekeeperId).subscribe({
      next: data => {
        this.applyStorekeeperData(data);
        this.savingStorekeeper = false;
        this.storekeeperFormOpen = false;
      },
      error: response => {
        this.savingStorekeeper = false;
        this.storekeeperError = response?.error?.error || 'Rolul de magazioner nu a putut fi salvat.';
      },
    });
  }

  removeStorekeeper(item: any): void {
    if (this.savingStorekeeper || !window.confirm(`Elimini rolul de magazioner pentru ${item.name}?`)) return;
    this.savingStorekeeper = true;
    this.storekeeperError = null;
    this.service.removeStorekeeper(item.employee_id).subscribe({
      next: data => {
        this.applyStorekeeperData(data);
        this.savingStorekeeper = false;
      },
      error: response => {
        this.savingStorekeeper = false;
        this.storekeeperError = response?.error?.error || 'Rolul de magazioner nu a putut fi eliminat.';
      },
    });
  }
  
  seeMagazie(){
    this.router.navigateByUrl('/magazie')
  }
  seeAngajati(){
    this.router.navigateByUrl('/angajati')
  }
  seeMateriale(){
    this.router.navigateByUrl('/materiale')
  }
  seeUnelte(){
    this.router.navigateByUrl('/unelte')
  }
  seeSchela(){
    this.router.navigateByUrl('/schela')
  }
  seeIstoric(){
    this.router.navigateByUrl('/magazie/istoric')
  }
  seePredare(){
    this.router.navigateByUrl('/predare-unealta')
  }
}
