import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-show-shed',
  templateUrl: './show-shed.component.html',
  styleUrls: ['./show-shed.component.css']
})
export class ShowShedComponent implements OnInit {

  constructor(private service:SharedService) { }

  ShedList:any=[];
  she:any;
  Pieces!: Number;
  ToolNameFilter:string="";
  ToolListWithoutFilter:any=[];
  Service:string="";
  UnfunctionalId:string="";
  ToolSerie:string="";
  ToolName:string="";
  Detail:string="";
  Status:string="";

  ActivateServiceTolComp:boolean=false;
  ActivateGiveToolToUser:boolean=false;


  ngOnInit(): void {
    this.refreshSedList();


  }

  addClick(){
    
    this.she={
      ShedId:0,
      ToolSerie:"",
      ToolName:"",
      User:"",
      DateOfGiving:"",
      Pin:"",
      Status:"",
      Pieces:"",
      Component:"",
      Provider:"",
      Detail:"",

    }
  }

  deleteClick(item: { ShedId: any; }){
    if(confirm('Esti sigur??')){
      this.service.deleteShed(item.ShedId).subscribe(data=>{
        (data.toString());
        this.refreshSedList();
      })
    }
  }



  FilterFn(){
    
    var ToolNameFilter = this.ToolNameFilter;

    this.ShedList = this.ToolListWithoutFilter.filter(function (el: { ToolId: 
      { toString: () => string; }; ToolName: { toString: () => string; }; }){
      return el.ToolName.toString().toLowerCase().includes(
        ToolNameFilter.toString().trim().toLowerCase()
      )
    });
  }

  changeSerClick(item: any){
    this.she=item;
    this.ActivateServiceTolComp=true;
  }



  GiveToolToUser(item: any){
    this.she=item;
    this.ActivateGiveToolToUser=true;
  }

  closeClick(){
    this.ActivateGiveToolToUser=false;
    this.ActivateServiceTolComp=false;
    this.refreshSedList();
  }


  refreshSedList(){
    this.service.getShedList().subscribe(data=>{
      this.ShedList=data;
      this.ToolListWithoutFilter=data;

    });
  }

}
