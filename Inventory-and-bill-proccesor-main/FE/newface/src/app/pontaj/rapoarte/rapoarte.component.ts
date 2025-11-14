import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-rapoarte',
  templateUrl: './rapoarte.component.html',
  styleUrls: ['./rapoarte.component.css']
})
export class RapoarteComponent {

  // Raport pe dată
  selectedDay = this.todayISO();

  // Raport pe firmă + lună
  companies: string[] = [
    'VB-ROM',
    'Servicex',
    // adaugi aici și alte firme dacă vrei
  ];
  selectedCompany: string | null = null;
  selectedMonth = this.currentMonth();  // YYYY-MM (pt. <input type="month">)

  loadingExcel = false;
  error: string | null = null;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  // --- helpers date ---
  todayISO(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  currentMonth(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  }

  // --- Raport pe dată ---
  openDayReport(): void {
    // deschide pagina de pontaj pe data aleasă (vezi mai jos modificarea în PontajComponent)
    this.router.navigate(['/pontaj'], {
      queryParams: { date: this.selectedDay }
    });
  }

  // --- Raport pe firmă + lună ---
  selectCompany(name: string): void {
    this.selectedCompany = name;
    this.error = null;
  }

  canGenerateCompanyReport(): boolean {
    return !!(this.selectedCompany && this.selectedMonth && !this.loadingExcel);
  }

  generateCompanyExcel(): void {
    if (!this.canGenerateCompanyReport()) return;

    this.loadingExcel = true;
    this.error = null;

    const [yearStr, monthStr] = this.selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const company = this.selectedCompany!;

    const body = {
      month,
      year,
      company
    };

    this.http.post('http://localhost:8000/api/pontaj/excel/', body, {
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        const safeCompany = company.replace(/\s+/g, '_');
        const m = String(month).padStart(2, '0');
        const fileName = `pontaj_${safeCompany}_${year}-${m}.xlsx`;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);

        this.loadingExcel = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Nu pot genera fișierul Excel. Verifică serverul.';
        this.loadingExcel = false;
      }
    });
  }
}
