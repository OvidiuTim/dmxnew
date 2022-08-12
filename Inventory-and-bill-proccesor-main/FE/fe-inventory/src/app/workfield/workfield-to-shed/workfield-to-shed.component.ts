import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-workfield-to-shed',
  templateUrl: './workfield-to-shed.component.html',
  styleUrls: ['./workfield-to-shed.component.css']
})
export class WorkfieldToShedComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() fil:any;

  ShedId!: string;
  ToolSerie!: string;
  ToolName!: string;
  User!: string;
  DateOfGiving!:any;
  BucketDate!: Date;
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
  Components!: string;
  Provider!: string;

  ActivateAlert:boolean=false;
  ActivateModal:boolean=true;

  PieceList:any=[];
  Piece = 0;

  ngOnInit(): void {
    this.UsedPieces = 1;
    this.service.getAllUserNames().subscribe((data:any)=>{
      this.UsersList=data;
      });
      
      this.WorkFieldId=this.fil.WorkFieldId;
      this.ToolSerie=this.fil.ToolSerie;
      this.ToolName=this.fil.ToolName;
      this.User=this.fil.User;
      this.DateOfGiving=this.fil.DateOfGiving;
      
      this.Status=this.fil.Status;
      this.Pieces=this.fil.Pieces;
      this.Components=this.fil.Components;
      this.Provider=this.fil.Provider;
      this.Detail=this.fil.Detail;

      while(this.Piece < this.Pieces)
      {
        console.log(this.Piece)
        this.Piece ++;
        this.PieceList.push(this.Piece)
      }
  }

  checkPassword() {
    let selectedUser = this.UsersList.find((User:any) => {
      return User.UserName === this.User
    } )
    return selectedUser.UserPin === this.Pin
  }

  addShed(){
    this.howManyTools()
      var val = {ShedId:this.ShedId,
        ToolSerie:this.ToolSerie,
        ToolName:this.ToolName,
        User:this.User ,
        DateOfGiving:this.DateOfGiving,
        Pin:this.Pin,
        Status:this.Status,
        Pieces:this.UsedPieces,
        Components:this.Components,
        Provider:this.Provider,
        Detail:this.Detail,
      };
        this.service.addShed(val).subscribe(res=>{
          (res.toString());});
  }

  howManyTools(){
    this.NewPieces = Number.parseInt(this.Pieces.toString()) - Number.parseFloat(this.UsedPieces.toString());
    this.Status = "Functionala"
  
  }

  addHistory(){
    this.Took = "a adus inapoi"
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


  updateWorkfield(){
    if(this.Pin == this.User){
    this.Pin = "1324";
    this.ActivateAlert=true;
    this.ActivateModal=false;
    this.BucketDate = new Date();
    this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    this.addShed();
    this.addHistory();
    var val = {WorkFieldId:this.WorkFieldId,
      ToolSerie:this.ToolSerie,
      ToolName:this.ToolName,
      User:this.User ,
      DateOfGiving:this.DateOfGiving,
      Pin:this.Pin,
      Status:this.Status,
      Pieces:this.NewPieces,
      Components:this.Components,
      Provider:this.Provider,
      Detail:this.Detail,};

      if(this.NewPieces == 0) {
        this.service.deleteWorkfield(val.WorkFieldId).subscribe(data=>{
          (data.toString());
        })
      }
      else {
      this.service.updateWorkfield(val).subscribe(res=>{
        (res.toString());

      });
      }}

      else{
        alert("ALTA PERSOANA A PRELUAT UNEALTA, ACTIUNEA NU A FOST EFECTUATA")
      }

  }

}



