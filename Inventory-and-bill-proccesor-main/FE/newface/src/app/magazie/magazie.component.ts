import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-magazie',
  templateUrl: './magazie.component.html',
  styleUrls: ['./magazie.component.css']
})
export class MagazieComponent implements OnInit {

  constructor(private router: Router, private service:SharedService) { }

  ngOnInit(): void {
    
    console.log(this.service.admin)
    alert(this.service.admin)
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
}
