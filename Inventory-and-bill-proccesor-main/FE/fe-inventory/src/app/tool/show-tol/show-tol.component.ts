import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-show-tol',
  templateUrl: './show-tol.component.html',
  styleUrls: ['./show-tol.component.css']
})
export class ShowTolComponent implements OnInit {

  constructor(private service:SharedService) { }

  ToolList:any=[];

  ModalTitle!: string;
  ActivateAddEditTolComp:boolean=false;
  tol:any;

  ToolNameFilter:string="";
  UserFilter:string="";
  ToolIdFilter:string="";

  Pieces:string="";
  MainLocation:string="";

  ToolListWithoutFilter:any=[];
  ToolListWithoutFilterUser:any=[];
  Password:boolean=true;
  brokenTool:boolean=false;
  WorkingTool:boolean=false;
  
  ActivateServiceTolComp:boolean=false;
  ActivateServiceInfoComp:boolean=false;


  ActivateGuveToolToUser:boolean=false;
  ActivateTakeToolFromUser:boolean=false;





  ngOnInit(): void {
    this.refreshTolList();
  }

  addClick(){
    
    this.tol={
      ToolId:0,
      ToolSerie:"",
      ToolName:"",
      User:"",
      DateOfGiving:"",
      Detail:"",
      Status:"",
      Service:"",
      Pieces:"",
      MainLocation:"",
    }
    
    this.ModalTitle="Adauga unealta";

    this.ActivateAddEditTolComp=true;

  }
  checkTool(){
    if(this){}
  }

  GiveToolToUser(item: any){
    this.tol=item;
    this.ModalTitle="Preia unealta catre angajat";
    this.ActivateGuveToolToUser=true;
  }

  TakeToolFromUser(item: any){
    this.tol=item;
    this.ModalTitle="Preda unealta de la angajat";
    this.ActivateTakeToolFromUser=true;
  }

  changeSerClick(item: any){
    this.tol=item;
    this.ModalTitle="Trimite in service";
    this.ActivateServiceTolComp=true;
  }

  seeServiceInfo(item: any){
    this.tol=item;
    this.ModalTitle="Informatii Service";
    this.ActivateServiceInfoComp=true;
  }

  deleteClick(item: { ToolId: any; }){
      this.service.deleteTool(item.ToolId).subscribe(data=>{
        (data.toString());
        this.refreshTolList();
      })
    
  }

  closeClick(){
    this.ActivateAddEditTolComp=false;
    this.ActivateGuveToolToUser=false;
    this.ActivateServiceTolComp=false;
    this.ActivateServiceInfoComp=false;
    this.ActivateTakeToolFromUser=false;
    this.refreshTolList();
  }


  refreshTolList(){
    this.service.getTolList().subscribe(data=>{
      this.ToolList=data;
      this.ToolListWithoutFilter=data;
      this.ToolListWithoutFilterUser=data;
      
    });
  }

  

  FilterFn(){
    
    var ToolNameFilter = this.ToolNameFilter;

    this.ToolList = this.ToolListWithoutFilter.filter(function (el: { ToolId: 
      { toString: () => string; }; ToolName: { toString: () => string; }; }){
      return el.ToolName.toString().toLowerCase().includes(
        ToolNameFilter.toString().trim().toLowerCase()
      )
    });
  }



}

