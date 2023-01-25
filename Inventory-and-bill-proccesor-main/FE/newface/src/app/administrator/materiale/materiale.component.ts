import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-materiale',
  templateUrl: './materiale.component.html',
  styleUrls: ['./materiale.component.css']
})
export class MaterialeComponent {
  
  constructor(private router: Router) { }
  
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
}
