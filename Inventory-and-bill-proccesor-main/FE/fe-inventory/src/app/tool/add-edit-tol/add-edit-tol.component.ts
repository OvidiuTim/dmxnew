import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-add-edit-tol',
  templateUrl: './add-edit-tol.component.html',
  styleUrls: ['./add-edit-tol.component.css']
})
export class AddEditTolComponent implements OnInit {

  
  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() tol:any;

  
  AddMorePiece:boolean=false;
  ActivateServiceComp:boolean=false;
  ActivateDetailsComp:boolean=false;
  ActivateAlert:boolean=false;
  ActivateModal:boolean=true;

  ToolId!: string;
  ShedId!: string;
  UnfunctionalId!: string;
  WorkFieldId!: string;
  ToolSerie!: string;
  Pieces!: Number;
  ToolName!: string;
  User!: string;
  DateOfGiving!:any;
  BucketDate!: Date;
  Provider!: string;
  Pin!: string;
  Detail!: string;
  Status!: string;
  Service!: string;
  MainLocation!: string;
  NewDetail!: string;

  UsersList:any=[];


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
    this.Pieces=this.tol.Pieces
    this.MainLocation=this.tol.MainLocation
    this.Provider=this.tol.Provider
    this.NewDetail = "Nu sunt detalii"

  }

  alertFinishChange(){
    this.ActivateAlert = true;
    this.ActivateModal = false;
  }

  NoMorePiece(){
    this.AddMorePiece = false
    this.Pieces = 1

  }

  MorePiece(){
    this.AddMorePiece = true
  }

  justAdd(){
    this.User = "Magazie"
    this.Status = "Functionala"
    this.Service = "Nu e in service"
    this.Pin = "1"
  }

  addInShed(){
    
    if(this.MainLocation=="Magazie"){
      this.BucketDate = new Date();
      this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
      var val = {ShedId:this.ShedId,
        ToolSerie:this.ToolSerie,
        ToolName:this.ToolName,
        User:this.User,
        DateOfGiving:this.DateOfGiving,
        Pin:this.Pin,
        Status:this.Status,
        Pieces:this.Pieces,
        Components:this.Detail,
        Provider:this.Provider,
        Detail:this.NewDetail
      };
        this.service.addShed(val).subscribe(res=>{
          (res.toString());});
      }
  }

  addWorkfield(){
    if(this.MainLocation=="Santier"){
      this.BucketDate = new Date();
      this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
      var val = {WorkFieldId:this.WorkFieldId,
        ToolSerie:this.ToolSerie,
        ToolName:this.ToolName,
        User:this.User,
        DateOfGiving:this.DateOfGiving,
        Pin:this.Pin,
        Status:this.Status,
        Pieces:this.Pieces,
        Components:this.Detail,
        Provider:this.Provider,
        Detail:this.NewDetail};
        this.service.addWorkfield(val).subscribe(res=>{
          alert(res.toString());});
      }
  }

  addinService(){
    if(this.MainLocation=="Nefuctionala"){
      this.BucketDate = new Date();
      this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
      this.Status = "Nefunctionala";
      this.Service = " Nu e inca in service/ adauga service ";
      var val = {UnfunctionalId:this.UnfunctionalId,
        ToolSerie:this.ToolSerie,
        ToolName:this.ToolName,
        Detail:this.NewDetail,
        Service:this.Service,
        Status:this.Status,
        Pieces:this.Pieces,
        Components:this.Detail,
        Provider:this.Provider,
      };
        this.service.addUnfunctional(val).subscribe(res=>{
          alert(res.toString());});
      }
  }




  addTool(){
    this.justAdd()
    this.BucketDate = new Date();
    this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    var val = {ToolId:this.ToolId,
                ToolSerie:this.ToolSerie,
                ToolName:this.ToolName,
                User:this.User,
                DateOfGiving:this.DateOfGiving,
                Pin:this.Pin,
                Detail:this.Detail,
                Status:this.Status,
                Service:this.Service,
                Pieces:this.Pieces,
                MainLocation:this.MainLocation,
                Provider:this.Provider,}


    this.service.addTool(val).subscribe(res=>{ alert
      (res.toString());
      this.alertFinishChange();
      this.addInShed();
      this.addWorkfield();
      this.addinService();
    });
    

  }


}



