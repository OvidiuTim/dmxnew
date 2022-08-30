import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-schelafatadamodulara',
  templateUrl: './schelafatadamodulara.component.html',
  styleUrls: ['./schelafatadamodulara.component.css']
})
export class SchelafatadamodularaComponent implements OnInit {

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
    this.service.getschelafatadaM().subscribe(data=>{
      this.MetalicList=data;
      this.MaterialListWithoutFilter=data;
    });
  }

  newClick(){
    
    this.cme={
      SchelaFatadaModularaId:0,
      SchelaFatadaModularaName:"",
      SchelaFatadaModularaCantitate:"",
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

    this.MetalicList = this.MaterialListWithoutFilter.filter(function (el: { SchelaFatadaModularaId: 
      { toString: () => string; }; SchelaFatadaModularaName: { toString: () => string; }; }){
      return el.SchelaFatadaModularaId.toString().toLowerCase().includes(
        MaterialIdFilter.toString().trim().toLowerCase()
      )&&
      el.SchelaFatadaModularaName.toString().toLowerCase().includes(
      MaterialNameFilter.toString().trim().toLowerCase()
      )
    });
  }
}
