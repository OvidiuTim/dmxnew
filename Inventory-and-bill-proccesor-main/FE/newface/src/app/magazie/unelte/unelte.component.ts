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
  
  NuAcelas:boolean=true;
  DaAcelas:boolean=false;


  startingPoint:string="";

  ngOnInit(): void {
    this.startingPoint = '1';
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



  
  Nuacelas(){
    this.NuAcelas=true;
    this.DaAcelas=false;
  
    document.getElementById("1")!.style.backgroundColor = '#d9d9d9';
  }
  Daacelas(){
    this.NuAcelas=false;
    this.DaAcelas=true;
  
    document.getElementById("2")!.style.backgroundColor = '#d9d9d9';
  }
}
