import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-usr-his',
  templateUrl: './usr-his.component.html',
  styleUrls: ['./usr-his.component.css']
})
export class UsrHisComponent implements OnInit {

  constructor(private service:SharedService) { }

  @Input() usr:any;
  @Input() his:any;

  UsersList:any=[];
  HistoryList:any=[];
  ConsumableList:any=[];

  ActivateSearch:boolean=true;
  ToolHistory:boolean=false;
  MaterialHistory:boolean=false;

  HistoryNameFilter:string="";
  HistoryListWithoutFilter:any=[];

  ConsumableNameFilter:string="";
  ConsumableListWithoutFilter:any=[];




  ngOnInit(): void  {
    this.refreshHisList();
    this.refreshConList();

    this.service.getHisList().subscribe((data:any)=>{
    this.HistoryList=data;
    });

    this.service.getAllUserNames().subscribe((data:any)=>{
    this.UsersList=data;
    });

    this.service.getConList().subscribe((data:any)=>{
    this.ConsumableList=data;
    });
  

  }


  showTolHisClick(){
    this.ToolHistory = true;
    this.MaterialHistory = false;    
    this.ActivateSearch = false;

  }
  
  showMatHisClick(){
    this.MaterialHistory = true;
    this.ToolHistory = false;
    this.ActivateSearch = false;

  }
  
  refreshHisList(){
    this.service.getHisList().subscribe(data=>{
      this.HistoryList=data;
      this.HistoryListWithoutFilter=data;
    });
  }

  FilterFn(){
    
    var HistoryNameFilter = this.HistoryNameFilter;

    this.HistoryList = this.HistoryListWithoutFilter.filter(function (el: { HistoryId: 
      { toString: () => string; }; User: { toString: () => string; }; }){
      return el.User.toString().toLowerCase().includes(
        HistoryNameFilter.toString().trim().toLowerCase()
      )
    });
  }


  refreshConList(){
    this.service.getConList().subscribe(data=>{
      this.ConsumableList=data;
      this.ConsumableListWithoutFilter=data;
    });
  }

  FilterForMat(){
    
    var ConsumableNameFilter = this.ConsumableNameFilter;

    this.ConsumableList = this.ConsumableListWithoutFilter.filter(function (el: { ConsumeId: 
      { toString: () => string; }; User: { toString: () => string; }; }){
      return el.User.toString().toLowerCase().includes(
        ConsumableNameFilter.toString().trim().toLowerCase()
      )
    });
  }




}
