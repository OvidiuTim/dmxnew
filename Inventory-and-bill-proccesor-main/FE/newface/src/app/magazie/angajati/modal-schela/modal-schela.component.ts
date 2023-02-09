import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { Router } from '@angular/router';
import { ThisReceiver } from '@angular/compiler';


@Component({
  selector: 'app-modal-schela',
  templateUrl: './modal-schela.component.html',
  styleUrls: ['./modal-schela.component.css']
})
export class ModalSchelaComponent implements OnInit {

  constructor(private router: Router, private service:SharedService) { }
  
  CofrajMetList:any=[];
  CofrajMetListWithoutFilter:any=[];
  CofrajMetLocationFilter:string="";
  CofrajMetLocationFilterMagazie:string="";
  CofrajMetNameFilter:string="";
  CofrajMetListmain:any=[];
  une:any

  selectedUserSimple : any



  cofMet:boolean=true;
  cofDoca:boolean=false;
  Popi:boolean=false;
  SUsoara:boolean=false;
  SFatada:boolean=false;
  Modulara:boolean=false;
  Mfixe:boolean=false;
  isUne:boolean=false;

  ngOnInit(): void {
    
    this.refreshTolList();

    this.cofrajmetalic()

    //aduce userul aici
    this.selectedUserSimple = this.service.selectedUser
    console.log(this.service.selectedUser.UserName)
  }

  FilterFn(){
    
    var CofrajMetLocationFilter = this.CofrajMetLocationFilter;

    this.CofrajMetList = this.CofrajMetListWithoutFilter.filter(function (el: { ToolId: 
      { toString: () => string; }; Location: { toString: () => string; }; }){
      return el.Location.toString().toLowerCase().includes(
        CofrajMetLocationFilter.toString().trim().toLowerCase()
      )
    });
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
  



  refreshTolList(){
    this.CofrajMetLocationFilter = ''+ this.selectedUserSimple.UserName


    var CofrajMetLocationFilter = this.CofrajMetLocationFilter;

    this.service.getCofMetList().subscribe(data=>{
      this.CofrajMetList=data.filter(function (el: {Location: 
        { toString: () => string; }; }) { 
          return el.Location.toString().toLowerCase().includes(
            CofrajMetLocationFilter.toString().trim().toLowerCase()
          ) 
        });

      this.CofrajMetLocationFilterMagazie = 'Magazie'
      var CofrajMetLocationFilterMagazie = this.CofrajMetLocationFilterMagazie;
      this.CofrajMetListmain=data.filter(function (el: {Location: 
        { toString: () => string; }; }) { 
          return el.Location.toString().toLowerCase().includes(
            CofrajMetLocationFilterMagazie.toString().trim().toLowerCase()
          ) 
        });

        this.CofrajMetListWithoutFilter=data;
    });
  
  }

  

  CofrajtTipDokaList:any=[];
  CofrajtTipDokaListFilter:any=[];
  CofrajtTipDokaLocationFilter:string="";
  CofrajtTipDokaLocationFilterMagazie:string="";
  CofrajtTipDokaNameFilter:string="";
  CofrajtTipDokaListmain:any=[];
  CofrajtTipDokaListWithoutFilter:any=[];
  

  refreshTolList2(){

    this.CofrajtTipDokaListFilter = ''+ this.selectedUserSimple.UserName

    var CofrajtTipDokaLocationFilter = this.CofrajtTipDokaLocationFilter;

    this.service.getDokaList().subscribe(data=>{
      this.CofrajtTipDokaList=data.filter(function (el: {Location: 
        { toString: () => string; }; }) { 
          return el.Location.toString().toLowerCase().includes(
            CofrajtTipDokaLocationFilter.toString().trim().toLowerCase()
          ) 
        });

      this.CofrajtTipDokaLocationFilterMagazie = 'Magazie'
      var CofrajtTipDokaLocationFilterMagazie = this.CofrajtTipDokaLocationFilterMagazie;
      this.CofrajMetListmain=data.filter(function (el: {Location: 
        { toString: () => string; }; }) { 
          return el.Location.toString().toLowerCase().includes(
            CofrajtTipDokaLocationFilterMagazie.toString().trim().toLowerCase()
          ) 
        });

        this.CofrajtTipDokaListWithoutFilter=data;
    });
  
  }
}
