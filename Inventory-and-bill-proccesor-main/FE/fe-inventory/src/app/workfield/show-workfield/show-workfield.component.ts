import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-show-workfield',
  templateUrl: './show-workfield.component.html',
  styleUrls: ['./show-workfield.component.css']
})
export class ShowWorkfieldComponent implements OnInit {

  constructor(private service:SharedService) { }

  FieldList:any=[];
  fil:any;
  ActivateTakeToolFromUser:boolean=false;

  ToolNameFilter:string="";
  ToolListWithoutFilter:any=[];


  ngOnInit(): void {
    this.refreshFilList();
  }

  closeClick(){
    this.ActivateTakeToolFromUser=false;
    this.refreshFilList();
  }

  deleteClick(item: { WorkFieldId: any; }){
    if(confirm('Esti sigur??')){
      this.service.deleteWorkfield(item.WorkFieldId).subscribe(data=>{
        (data.toString());
        this.refreshFilList();
      })
    }
  }

  TakeToolFromUser(item: any){
    this.fil=item;
    this.ActivateTakeToolFromUser=true;
  }

  FilterFn(){
    
    var ToolNameFilter = this.ToolNameFilter;

    this.FieldList = this.ToolListWithoutFilter.filter(function (el: { ToolId: 
      { toString: () => string; }; ToolName: { toString: () => string; }; }){
      return el.ToolName.toString().toLowerCase().includes(
        ToolNameFilter.toString().trim().toLowerCase()
      )
    });
  }



  refreshFilList(){
    this.service.getWfList().subscribe(data=>{
      this.FieldList=data;
      this.ToolListWithoutFilter=data;
    });
  }

}
