import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-service-tol',
  templateUrl: './service-tol.component.html',
  styleUrls: ['./service-tol.component.css']
})
export class ServiceTolComponent implements OnInit {
  
  constructor(private service:SharedService) { }
  @Input() tol:any;

  Broken:boolean=false;
  Repair :boolean=false;
  ActivateAlert:boolean=false;
  ActivateModal:boolean=true;
  ToolId!: string;
  ToolSerie!: string;
  ToolName!: string;
  User!: string;
  DateOfGiving!: string;
  Pin!: string;
  HistoryId!: string;
  Detail!: string;
  Status!: string;
  Service!: string;
  MainLocation!: string;
  Pieces!: Number;

  UsersList:any=[];

  BrokeDown(){
    this.Broken = true;
    this.Repair = false;
    this.MainLocation= "Service"
    this.Status = "Nefunctionala"
  }

  Repaired()
  {
    this.Repair= true;
    this.Broken = false;

    this.MainLocation= "Magazie"
    this.Status = "Functionala"

  }

  ngOnInit(): void {
    this.service.getAllUserNames().subscribe((data:any)=>{
    this.UsersList=data;
    });
    
    this.ToolId=this.tol.ToolId;
    this.ToolSerie=this.tol.ToolSerie;
    this.ToolName=this.tol.ToolName;
    this.User=this.tol.User;
    this.DateOfGiving=this.tol.DateOfGiving;
    this.Pin=this.tol.Pin;
    this.Detail=this.tol.Detail
    this.Status=this.tol.Status
    this.Service=this.tol.Service
    
  }

  alertFinishChange(){
    this.ActivateAlert = true;
    this.ActivateModal = false;
  }



  updateTool(){

    var val = {ToolId:this.ToolId,
      ToolSerie:this.ToolSerie,
      ToolName:this.ToolName,
      User:this.User ,
      DateOfGiving:this.DateOfGiving,
      Pin:this.Pin,
      Detail:this.Detail,
      Status:this.Status,
      Service:this.Service,
      Pieces:this.Pieces,
      MainLocation:this.MainLocation};

      this.service.updateTool(val).subscribe(res=>{
      alert(res.toString());
      this. alertFinishChange();
      });

  }

}

