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

  constructor(private router: Router, private service:SharedService) { }

  ngOnInit(): void {
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
