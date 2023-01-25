import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-istoric',
  templateUrl: './istoric.component.html',
  styleUrls: ['./istoric.component.css']
})
export class IstoricComponent {
  
  constructor(private router: Router) { }

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
    this.router.navigateByUrl('/istoric')
  }
}
