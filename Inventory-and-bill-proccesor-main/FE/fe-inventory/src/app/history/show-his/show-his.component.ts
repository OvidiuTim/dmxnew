import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-show-his',
  templateUrl: './show-his.component.html',
  styleUrls: ['./show-his.component.css']
})
export class ShowHisComponent implements OnInit {

  constructor(private service:SharedService) { }

  HistoryList:any=[];

  ModalTitle:string | undefined;
  ActivateAddEditHisComp:boolean=false;
  his:any;
  


  ngOnInit(): void {
    this.refreshHisList();
  }

  addClick(){
    this.his={
      HistoryId:0,
      User:"",
      Tool:"",
      DateOfGiving:"",
      ToolSerie:"",
      GiveRecive:"",
      Pieces:"",
      
    }
    this.ModalTitle="Adauga";
    this.ActivateAddEditHisComp=true;

  }

  editClick(item: any){
    this.his=item;
    this.ModalTitle="Edit Department";
    this.ActivateAddEditHisComp=true;
  }

  deleteClick(item: { HistoryId: any; }){
    
      this.service.deleteHistory(item.HistoryId).subscribe(data=>{
        (data.toString());
        this.refreshHisList();
      })
    
  }

  closeClick(){
    this.ActivateAddEditHisComp=false;
    this.refreshHisList();
  }




  refreshHisList(){
    this.service.getHisList().subscribe(data=>{
      this.HistoryList=data;
       });
  }

}