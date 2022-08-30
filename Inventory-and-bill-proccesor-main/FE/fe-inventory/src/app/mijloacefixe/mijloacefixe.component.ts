import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-mijloacefixe',
  templateUrl: './mijloacefixe.component.html',
  styleUrls: ['./mijloacefixe.component.css']
})
export class MijloacefixeComponent implements OnInit {

  constructor(private service:SharedService) { }


  MetalicList:any=[];
  ModalTitle!: string;
  ActivateAddMetalComp:boolean=false;
  ActivateEditMetalComp:boolean=false;
  cme:any;



  ngOnInit(): void {
    this.refreshMatList();
  }

 

  refreshMatList(){
    this.service.getmijloace().subscribe(data=>{
      this.MetalicList=data;
      this.MaterialListWithoutFilter=data;
    });
  }

  newClick(){
    
    this.cme={
      MijloaceFixeId:0,
      MijloaceFixeName:"",
      MijloaceFixeCantitate:"",
      Location:"",
    }
    this.ActivateAddMetalComp=true;
    this.refreshMatList();
  }
  predarecofrag(item: any){
    this.cme=item;
    this.ActivateEditMetalComp=true;
    this.refreshMatList();
  }

  closeClick(){
    this.refreshMatList();
    this.ActivateAddMetalComp=false;
    this.ActivateEditMetalComp=false;
    this.refreshMatList();
  }

  MaterialNameFilter:string="";
  MaterialListWithoutFilter:any=[];
  MaterialIdFilter:string="";
  FilterFn(){
    var MaterialIdFilter = this.MaterialIdFilter;
    var MaterialNameFilter = this.MaterialNameFilter;

    this.MetalicList = this.MaterialListWithoutFilter.filter(function (el: { MijloaceFixeId: 
      { toString: () => string; }; MijloaceFixeName: { toString: () => string; }; }){
      return el.MijloaceFixeId.toString().toLowerCase().includes(
        MaterialIdFilter.toString().trim().toLowerCase()
      )&&
      el.MijloaceFixeName.toString().toLowerCase().includes(
      MaterialNameFilter.toString().trim().toLowerCase()
      )
    });
  }
}
