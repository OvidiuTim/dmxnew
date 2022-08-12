import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-take-tol-from-user',
  templateUrl: './take-tol-from-user.component.html',
  styleUrls: ['./take-tol-from-user.component.css']
})
export class TakeTolFromUserComponent implements OnInit {

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
  GaveIt!: string;
  NewPieces!: Number;
  Pieces!: Number;
  UsedPieces!: Number;

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

  checkPassword() {
    let selectedUser = this.UsersList.find((User:any) => {
      return User.UserName === this.User
    } )
    return selectedUser.UserPin === this.Pin
  }
  howManyTools(){
    this.NewPieces = Number.parseInt(this.Pieces.toString()) + Number.parseFloat(this.UsedPieces.toString());
  }

  justUpdate(){
    this.Status = "Functionala"
  }

  addHistory(){
    this.Gave();
    var val = {HistoryId:this.HistoryId,
      Tool:this.ToolName,
      User:this.User,
      DateOfGiving:this.DateOfGiving,
      ToolSerie:this.ToolSerie,
      GiveRecive:this.GaveIt,
      Pieces:this.UsedPieces
      };
      this.service.addHistory(val).subscribe(res=>{
        (res.toString());});
  }

  Gave(){
    this.GaveIt = "a inapoiat"
  }

  alertFinishChange(){
    this.ActivateAlert = true;
    this.ActivateModal = false;
  }

  updateTool(){
    this.howManyTools()
    if (this.checkPassword()){
      this.justUpdate();
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
