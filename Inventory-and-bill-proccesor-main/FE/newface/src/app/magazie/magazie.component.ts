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

  constructor(private router: Router, private service:SharedService) { }

  ngOnInit(): void {
    forkJoin({
      employees: this.service.getUsrList(),
      tools: this.service.getTolList(),
      materials: this.service.getMatList(),
      movements: this.service.getHisList(),
    }).subscribe({
      next: data => {
        this.counts = {
          employees: data.employees?.length ?? 0,
          tools: data.tools?.length ?? 0,
          materials: data.materials?.length ?? 0,
          movements: data.movements?.length ?? 0,
        };
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Rezumatul magaziei nu a putut fi încărcat.';
      }
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
