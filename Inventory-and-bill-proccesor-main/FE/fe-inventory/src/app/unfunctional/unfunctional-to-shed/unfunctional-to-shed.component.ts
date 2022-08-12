import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-unfunctional-to-shed',
  templateUrl: './unfunctional-to-shed.component.html',
  styleUrls: ['./unfunctional-to-shed.component.css']
})
export class UnfunctionalToShedComponent implements OnInit {

  constructor(private service:SharedService) { }

  @Input() unf:any;

  UnfunctionalId!: string;

  ShedId!: string;
  User!: string;
  DateOfGiving!: string;
  Pin!: string;

  ToolSerie!: string;
  ToolName!: string;
  Detail!: string;
  Status!: string;
  Service!: string;
  Pieces!: Number;
  UsedPieces!: Number;
  NewPieces!: Number;
  Components!: string;
  Provider!: string;
  ActivateAlert:boolean=false;
  ActivateModal:boolean=true;

  PieceList:any=[];
  Piece = 0;




  ngOnInit(): void {
    
    this.UnfunctionalId=this.unf.UnfunctionalId;
    this.ToolSerie=this.unf.ToolSerie;
    this.ToolName=this.unf.ToolName;
    this.Detail=this.unf.Detail
    this.Status=this.unf.Status
    this.Service=this.unf.Service
    this.Pieces=this.unf.Pieces
    this.Components=this.unf.Components
    this.Provider=this.unf.Provider

    while(this.Piece < this.Pieces)
    {
      console.log(this.Piece)
      this.Piece ++;
      this.PieceList.push(this.Piece)
    }

  }




  howManyTools(){
    this.NewPieces = Number.parseInt(this.Pieces.toString()) - Number.parseFloat(this.UsedPieces.toString());
  }


  addShed(){
    this.User="M"
    this.DateOfGiving="0001-01-01"
    this.Pin="1"
    this.Status="Functionala"

    this.howManyTools()
      var val = {ShedId:this.ShedId,
        ToolSerie:this.ToolSerie,
        ToolName:this.ToolName,
        User:this.User ,
        DateOfGiving:this.DateOfGiving,
        Pin:1,
        Status:this.Status,
        Pieces:this.UsedPieces,
        Components:this.Components,
        Provider:this.Provider,
        Detail:this.Detail,
      };
        this.service.addShed(val).subscribe(res=>{
          alert(res.toString());});
  }


  updateTool(){
    this.addShed()
    this.ActivateAlert = true;
    this.ActivateModal = false;
    var val = {UnfunctionalId:this.UnfunctionalId,
      ToolSerie:this.ToolSerie,
      ToolName:this.ToolName,
      Detail:this.Detail,
      Service:this.Service,
      Status:this.Status,
      Pieces:this.Pieces,
      Components:this.Components,
      Provider:this.Provider,};

      if(this.NewPieces == 0) {
        this.service.deleteUnfunctional(val.UnfunctionalId).subscribe(data=>{
          alert(data.toString());
        })
      }
      else {
        this.service.updateUnfunctional(val).subscribe(res=>{alert
          (res.toString());
          });
      } 
    }
}