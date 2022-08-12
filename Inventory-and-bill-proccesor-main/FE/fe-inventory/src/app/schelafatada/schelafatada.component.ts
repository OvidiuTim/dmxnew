import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-schelafatada',
  templateUrl: './schelafatada.component.html',
  styleUrls: ['./schelafatada.component.css']
})
export class SchelafatadaComponent implements OnInit {

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
    this.service.getschelafatada().subscribe(data=>{
      this.MetalicList=data;
    });
  }

  newClick(){
    
    this.cme={
      SchelaFatadaId:0,
      SchelaFatadaName:"",
      SchelaFatadaCantitate:"",
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
}
