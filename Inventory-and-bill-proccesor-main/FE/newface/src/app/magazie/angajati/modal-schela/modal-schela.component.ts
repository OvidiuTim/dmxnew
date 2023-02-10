import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { Router } from '@angular/router';
import { ThisReceiver } from '@angular/compiler';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-modal-schela',
  templateUrl: './modal-schela.component.html',
  styleUrls: ['./modal-schela.component.css']
})
export class ModalSchelaComponent implements OnInit {

  constructor(private router: Router, private service:SharedService, private datePipe: DatePipe) { }
  HistoryId:string="";
  CofrajMetList:any=[];
  CofrajMetListWithoutFilter:any=[];
  CofrajMetLocationFilter:string="";
  CofrajMetLocationFilterMagazie:string="";
  CofrajMetNameFilter:string="";
  CofrajMetListmain:any=[];
  une:any
  DateOfGiving!:any;


  selectedUserSimple : any


    HistoriesScheleId:string="";
    SchelaName:string="";
    UserName:string="";
    CombustibilCantitate:string="";
    DateSchela:string="";


  cofMet:boolean=true;
  cofDoca:boolean=false;
  Popi:boolean=false;
  SUsoara:boolean=false;
  SFatada:boolean=false;
  Modulara:boolean=false;
  Mfixe:boolean=false;
  isUne:boolean=false;

  BucketDate!: Date;
  ngOnInit(): void {
    this.cofrajmetalic();


    //aduce userul aici
    this.selectedUserSimple = this.service.selectedUser

    this.refreshTolList();
    this.BucketDate = new Date();
    this.DateOfGiving= (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    console.log(this.DateOfGiving)
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
    this.CofrajMetLocationFilter = this.selectedUserSimple.UserName


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

  cfm:any


  CofrajMetalicId:string="";
  CofrajMetalicName:string="";
  CofrajMetalicCantitate:string="";
  Location:string="";

  predareCofMet(item: any){
    this.CofrajMetLocationFilter=''

    this.cfm=item;

    this.CofrajMetalicId=this.cfm.CofrajMetalicId;
    this.CofrajMetalicName=this.cfm.CofrajMetalicName;
    this.CofrajMetalicCantitate=this.cfm.CofrajMetalicCantitate;
    this.Location=this.selectedUserSimple.UserName;
    

    var val = {
      CofrajMetalicId:this.CofrajMetalicId,
      CofrajMetalicName:this.CofrajMetalicName,
      CofrajMetalicCantitate:this.CofrajMetalicCantitate,
      Location:this.Location,
    
    };

    this.service.updateCofMet(val).subscribe(res=>{
    console.log(res.toString());
    });


    

    this.refreshTolList()

  }
  

  preluareCofMet(item: any){
    this.CofrajMetLocationFilter=''

    this.cfm=item;

    this.CofrajMetalicId=this.cfm.CofrajMetalicId;
    this.CofrajMetalicName=this.cfm.CofrajMetalicName;
    this.CofrajMetalicCantitate=this.cfm.CofrajMetalicCantitate;
    this.Location=this.selectedUserSimple.UserName;
    

    var val = {
      CofrajMetalicId:this.CofrajMetalicId,
      CofrajMetalicName:this.CofrajMetalicName,
      CofrajMetalicCantitate:this.CofrajMetalicCantitate,
      Location:'Magazie',
    
    };

    this.service.updateCofMet(val).subscribe(res=>{
    console.log(res.toString());
    });

    this.refreshTolList()

     

    var valo = {HistoryId:this.HistoryId,
      Tool:this.CofrajMetalicName,
      User:this.selectedUserSimple.UserName,
      DateOfGiving:this.DateOfGiving,
      ToolSerie:"cofrajmetalic",
      GiveRecive:"a predat",
      Pieces:"cofrajmetalic"
      };
      this.service.addHistory(valo).subscribe(res=>{
      console.log(res.toString());});
      console.log(this.DateOfGiving)

  }
  
  CofrajtTipDokaList:any=[];
  CofrajtTipDokaListFilter:any=[];
  CofrajtTipDokaLocationFilter:string="";
  CofrajtTipDokaLocationFilterMagazie:string="";
  CofrajtTipDokaNameFilter:string="";
  CofrajtTipDokaListmain:any=[];
  CofrajtTipDokaListWithoutFilter:any=[];


  CofrajtTipDokaId:string="";
  CofrajtTipDokaName:string="";
  CofrajtTipDokaCantitate:string="";
  

  refreshTolList2(){

    this.CofrajtTipDokaListFilter = this.selectedUserSimple.UserName

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
