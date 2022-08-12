import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-shed-to-workplace',
  templateUrl: './shed-to-workplace.component.html',
  styleUrls: ['./shed-to-workplace.component.css']
})
export class ShedToWorkplaceComponent implements OnInit {
  

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() she:any

  ActivateServiceComp:boolean=false;
  ActivateDetailsComp:boolean=false;
  ActivateAlert:boolean=false;
  ActivateModal:boolean=true;
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
  PieceList:any=[];
  Piece = 0;

  



  ngOnInit(): void {
    this.service.getAllUserNames().subscribe((data:any)=>{
      this.UsersList=data;
      });
      this.UsedPieces = 1;
      this.ShedId=this.she.ShedId;
      this.ToolSerie=this.she.ToolSerie;
      this.ToolName=this.she.ToolName;
      
      this.DateOfGiving=this.she.DateOfGiving;
      
      this.Status=this.she.Status
      this.Pieces=this.she.Pieces
      this.Components=this.she.Components
      this.Provider=this.she.Provider
      this.Detail=this.she.Detail

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

  addWorkfield(){
    this.howManyTools()
      var val = {WorkFieldId:this.WorkFieldId,
        ToolSerie:this.ToolSerie,
        ToolName:this.ToolName,
        User:this.User,
        DateOfGiving:this.DateOfGiving,
        Pin:this.Pin,
        Status:this.Status,
        Pieces:this.UsedPieces,
        Components:this.Components,
        Provider:this.Provider,
        Detail:this.Detail,
      };
        this.service.addWorkfield(val).subscribe(res=>{
          (res.toString());});
  }

  howManyTools(){
    this.NewPieces = Number.parseInt(this.Pieces.toString()) - Number.parseFloat(this.UsedPieces.toString());
    this.Status = "Functionala"
  
  }

  addHistory(){
    this.Took = "a luat"
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




  updateShed(){
    this.Pin = "1324"
    this.ActivateAlert=true;
    this.ActivateModal=false;
    this.BucketDate = new Date();
    this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    this.addWorkfield();
    this.addHistory();
    var val = {ShedId:this.ShedId,
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

        this.service.deleteShed(val.ShedId).subscribe(data=>{
          (data.toString());
        })
      }
      else{
        this.service.updateShed(val).subscribe(res=>{
          (res.toString());

      });
      }
  }

}
