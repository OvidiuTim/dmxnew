import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-givetool',
  templateUrl: './givetool.component.html',
  styleUrls: ['./givetool.component.css']
})
export class GivetoolComponent implements OnInit {

  constructor(private service:SharedService,  private datePipe: DatePipe) { }

  ShedList:any=[];
  ToolNameFilter:string="";
  ToolListWithoutFilter:any=[];
  ActivateGoNext:boolean=false;

  ngOnInit(): void {
    this.refreshSedList();

  }

  GoNext(){
    this.ActivateGoNext = true;
    
    }

  refreshSedList(){
    this.service.getShedList().subscribe(data=>{
      this.ShedList=data;
      this.ToolListWithoutFilter=data;
    });
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
}
