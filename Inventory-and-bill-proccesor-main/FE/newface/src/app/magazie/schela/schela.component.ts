import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-schela',
  templateUrl: './schela.component.html',
  styleUrls: ['./schela.component.css']
})
export class SchelaComponent {

  constructor(private router: Router) { }
  
  cofMet:boolean=true;
  cofDoca:boolean=false;
  Popi:boolean=false;
  SUsoara:boolean=false;
  SFatada:boolean=false;
  Modulara:boolean=false;
  Mfixe:boolean=false;


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
    this.router.navigateByUrl('/istoric')
  }

  checkmyscafoldingid(){
    for(let i=1; i<=7; i++){
      document.getElementById(''+ i)!.style.backgroundColor = '#efefef';
      document.getElementById(''+ i)!.style.fontWeight = 'normal';
    }
  }
  cofrajmetalic(){
  this.cofMet=true;
  this.cofDoca=false;
  this.Popi=false;
  this.SUsoara=false;
  this.SFatada=false;
  this.Modulara=false; 
  this.Mfixe=false;

  this.checkmyscafoldingid();
  document.getElementById("1")!.style.backgroundColor = '#d9d9d9';
  document.getElementById("1")!.style.fontWeight = 'bold';
  }
  
  cofrajDoca(){
    this.cofMet=false;
    this.cofDoca=true;
    this.Popi=false;
    this.SUsoara=false;
    this.SFatada=false;
    this.Modulara=false;
    this.Mfixe=false;

    this.checkmyscafoldingid();
    document.getElementById("2")!.style.backgroundColor = '#d9d9d9';
    document.getElementById("2")!.style.fontWeight = 'bold';
  }
  
  Popibtn(){
    this.cofMet=false;
    this.cofDoca=false;
    this.Popi=true;
    this.SUsoara=false;
    this.SFatada=false;
    this.Modulara=false;
    this.Mfixe=false;

    this.checkmyscafoldingid();
    document.getElementById("3")!.style.backgroundColor = '#d9d9d9';
    document.getElementById("3")!.style.fontWeight = 'bold';
  }

  Susoara(){
    this.cofMet=false;
    this.cofDoca=false;
    this.Popi=false;
    this.SUsoara=true;
    this.SFatada=false;
    this.Modulara=false;
    this.Mfixe=false;

    this.checkmyscafoldingid();
    document.getElementById("4")!.style.backgroundColor = '#d9d9d9';
    document.getElementById("4")!.style.fontWeight = 'bold';
  }  

  Sfatafa(){
    this.cofMet=false;
    this.cofDoca=false;
    this.Popi=false;
    this.SUsoara=false;
    this.SFatada=true;
    this.Modulara=false;
    this.Mfixe=false;

    this.checkmyscafoldingid();
    document.getElementById("5")!.style.backgroundColor = '#d9d9d9';
    document.getElementById("5")!.style.fontWeight = 'bold';
  }  

  Mdulara(){
    this.cofMet=false;
    this.cofDoca=false;
    this.Popi=false;
    this.SUsoara=false;
    this.SFatada=false;
    this.Modulara=true;
    this.Mfixe=false;

    this.checkmyscafoldingid();
    document.getElementById("6")!.style.backgroundColor = '#d9d9d9';
    document.getElementById("6")!.style.fontWeight = 'bold';
  }  

  mfixe(){
    this.cofMet=false;
    this.cofDoca=false;
    this.Popi=false;
    this.SUsoara=false;
    this.SFatada=false;
    this.Modulara=false;
    this.Mfixe=true;

    this.checkmyscafoldingid();
    document.getElementById("7")!.style.backgroundColor = '#d9d9d9';
    document.getElementById("7")!.style.fontWeight = 'bold';
  }
  
}
