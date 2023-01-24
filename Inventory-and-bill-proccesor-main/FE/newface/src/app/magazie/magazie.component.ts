import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-magazie',
  templateUrl: './magazie.component.html',
  styleUrls: ['./magazie.component.css']
})
export class MagazieComponent {

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
