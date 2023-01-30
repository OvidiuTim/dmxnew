import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-unelte',
  templateUrl: './unelte.component.html',
  styleUrls: ['./unelte.component.css']
})
export class UnelteComponent implements OnInit {

  constructor(private router: Router, private service:SharedService) { }
  

  ngOnInit(): void {

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
