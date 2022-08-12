import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-shed-to-unfunctional',
  templateUrl: './shed-to-unfunctional.component.html',
  styleUrls: ['./shed-to-unfunctional.component.css']
})
export class ShedToUnfunctionalComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() she:any

  BrokenInShed:boolean=true;
  BrokenInService:boolean=false;

  ActivateAlert:boolean=false;
  ActivateModal:boolean=true;
  UsedPieces!: Number;
  
  UnfunctionalId!: string;
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
  MainLocation!: string;
  Pieces!: Number;
  NewPieces!: Number;
  Components!: string;
  Provider!: string;
  Piece = 0;
  PieceList:any=[];

  UsersList:any=[];


  ngOnInit(): void {
    this.service.getAllUserNames().subscribe((data:any)=>{
    this.UsersList=data;
    });
    
    this.ShedId=this.she.ShedId;
    this.ToolSerie=this.she.ToolSerie;
    this.ToolName=this.she.ToolName;
    this.User=this.she.User;
    this.DateOfGiving=this.she.DateOfGiving;
    this.Pin=this.she.Pin;
    this.Detail=this.she.Detail
    this.Status=this.she.Status
    this.Service=this.she.Service
    this.Pieces=this.she.Pieces
    this.Components=this.she.Components
    this.Provider=this.she.Provider
    this.Detail=this.she.Detail
    this.UsedPieces = 1;
    while(this.Piece < this.Pieces)
    {
      console.log(this.Piece)
      this.Piece ++;
      this.PieceList.push(this.Piece)
    }
    
  }

  alertFinishChange(){
    this.ActivateAlert = true;
    this.ActivateModal = false;
  }

  brokenInService(){
    this.BrokenInService= true;
    this.BrokenInShed = false;
    this.Status = "Nefunctionala"
  }

  brokenInShed(){
    this.BrokenInShed= true;
    this.BrokenInService = false;
    this.Service= "Nu e inca in service"
    this.Status = "Nefunctionala"
    
  }

  howManyTools(){
    this.NewPieces = Number.parseInt(this.Pieces.toString()) - Number.parseFloat(this.UsedPieces.toString());
  }


  addUnfunctional(){
    this.howManyTools()
      var val = {UnfunctionalId:this.UnfunctionalId,
        ToolSerie:this.ToolSerie,
        ToolName:this.ToolName,
        Detail:this.Detail,
        Service:this.Service,
        Status:this.Status,
        Pieces:this.Pieces,
        Components:this.Components,
        Provider:this.Provider,
      };
        this.service.addUnfunctional(val).subscribe(res=>{
          alert(res.toString());});
      
  }


  updateShed(){
    this.alertFinishChange();
    this.BucketDate = new Date();
    this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    this.addUnfunctional();
    var val = {ShedId:this.ShedId,
      ToolSerie:this.ToolSerie,
      ToolName:this.ToolName,
      User:this.User ,
      DateOfGiving:this.DateOfGiving,
      Pin:1,
      Status:this.Status,
      Pieces:this.NewPieces,
      Components:this.Components,
      Provider:this.Provider,
      Detail:this.Detail,};

    if(this.NewPieces == 0) {
        this.service.deleteShed(val.ShedId).subscribe(data=>{
        alert  (data.toString());
        })
    }
    else{

        this.service.updateShed(val).subscribe(res=>{
          alert(res.toString());

      });
    }

  }

}


