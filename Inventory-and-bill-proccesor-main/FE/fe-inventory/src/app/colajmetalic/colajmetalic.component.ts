import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-colajmetalic',
  templateUrl: './colajmetalic.component.html',
  styleUrls: ['./colajmetalic.component.css']
})
export class ColajmetalicComponent implements OnInit {

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
    this.service.getCofMetList().subscribe(data=>{
      this.MetalicList=data;
      this.MaterialListWithoutFilter=data;
    });
  }

  newClick(){
    
    this.cme={
      CofrajMetalicId:0,
      CofrajMetalicName:"",
      CofrajMetalicCantitate:"",
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

    this.MetalicList = this.MaterialListWithoutFilter.filter(function (el: { CofrajMetalicId: 
      { toString: () => string; }; CofrajMetalicName: { toString: () => string; }; }){
      return el.CofrajMetalicId.toString().toLowerCase().includes(
        MaterialIdFilter.toString().trim().toLowerCase()
      )&&
      el.CofrajMetalicName.toString().toLowerCase().includes(
      MaterialNameFilter.toString().trim().toLowerCase()
      )
    });
  }
}
