import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-schelausoara',
  templateUrl: './schelausoara.component.html',
  styleUrls: ['./schelausoara.component.css']
})
export class SchelausoaraComponent implements OnInit {

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
    this.service.getschelausoara().subscribe(data=>{
      this.MetalicList=data;
      this.MaterialListWithoutFilter=data;

    });
  }

  newClick(){
    
    this.cme={
      SchelaUsoaraId:0,
      SchelaUsoaraName:"",
      SchelaUsoaraCantitate:"",
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

    this.MetalicList = this.MaterialListWithoutFilter.filter(function (el: { SchelaUsoaraId: 
      { toString: () => string; }; SchelaUsoaraName: { toString: () => string; }; }){
      return el.SchelaUsoaraId.toString().toLowerCase().includes(
        MaterialIdFilter.toString().trim().toLowerCase()
      )&&
      el.SchelaUsoaraName.toString().toLowerCase().includes(
      MaterialNameFilter.toString().trim().toLowerCase()
      )
    });
  }
}
