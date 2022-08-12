import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-just-edit-tol',
  templateUrl: './just-edit-tol.component.html',
  styleUrls: ['./just-edit-tol.component.css']
})
export class JustEditTolComponent implements OnInit {

  constructor(private service:SharedService) { }
  @Input() tol:any;

  
  ActivateServiceComp:boolean=false;
  ActivateDetailsComp:boolean=false;
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
  NewPieces!: Number;
  Pieces!: Number;
  UsedPieces!: Number;
  Took!: string;
  MainLocation!: string;
  WorkFieldId!: string;
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
    
  }

  addWorkfield(){
    this.Status = "Functionala"
    this.MainLocation="Santier"
      var val = {WorkFieldId:this.WorkFieldId,
        ToolSerie:this.ToolSerie,
        ToolName:this.ToolName,
        User:this.User,
        DateOfGiving:this.DateOfGiving,
        Pin:this.Pin,
        Status:this.Status,
        Pieces:this.Pieces,
      };
        this.service.addWorkfield(val).subscribe(res=>{
          alert(res.toString());});
  
  }

  howManyTools(){
    this.NewPieces = Number.parseInt(this.Pieces.toString()) - Number.parseFloat(this.UsedPieces.toString());
  }

  CheckDetails(){
    this.ActivateDetailsComp=true;
  }

  TookIt(){
    this.Took = "a luat"
  }


  alertFinishChange(){
    this.ActivateAlert = true;
    this.ActivateModal = false;
  }

  checkPassword() {
    let selectedUser = this.UsersList.find((User:any) => {
      return User.UserName === this.User
    } )
    return selectedUser.UserPin === this.Pin
  }

  addHistory(){
    this.TookIt();
    var val = {HistoryId:this.HistoryId,
      Tool:this.ToolName,
      User:this.User,
      DateOfGiving:this.DateOfGiving,
      ToolSerie:this.ToolSerie,
      GiveRecive:this.Took,
      Pieces:this.UsedPieces
      };
      this.service.addHistory(val).subscribe(res=>{
        (res.toString());});
  }



  updateTool(){
    this.howManyTools()
    if (this.checkPassword()){
      this.addWorkfield()
    var val = {ToolId:this.ToolId,
      ToolSerie:this.ToolSerie,
      ToolName:this.ToolName,
      User:this.User ,
      DateOfGiving:this.DateOfGiving,
      Pin:this.Pin,
      Detail:this.Detail,
      Status:this.Status,
      Service:this.Service,
      Pieces:this.NewPieces};

      this.service.updateTool(val).subscribe(res=>{alert
      (res.toString());
      this.addHistory();
      this.alertFinishChange();
      });
      }
    else{
      alert('parola gresita');
      }

  }

}

