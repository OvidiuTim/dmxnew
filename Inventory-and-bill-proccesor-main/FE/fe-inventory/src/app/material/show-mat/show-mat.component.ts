import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { ngxCsv } from 'ngx-csv/ngx-csv';

@Component({
  selector: 'app-show-mat',
  templateUrl: './show-mat.component.html',
  styleUrls: ['./show-mat.component.css']
})
export class ShowMatComponent implements OnInit {

  constructor(private service:SharedService) { }

  MaterialList:any=[];

  ModalTitle!: string;
  ActivateNewMatComp:boolean=false;
  ActivateAddMatComp:boolean=false;
  ActivateRemoveMatComp:boolean=false;
  ActivateProvider:boolean=false;
  DeactivateProvider:boolean=true;
  mat:any;

  MaterialNameFilter:string="";
  MaterialListWithoutFilter:any=[];
  MaterialIdFilter:string="";







  ngOnInit(): void {
    this.refreshMatList();
  }

  newClick(){
    
    this.mat={
      MaterialId:0,
      MaterialName:"",
      Quantity:"",
      Amount:"",
      MaterialLocation:"",
      OneUnity:"",
      UnityOfMesurment:"",
      TypeOfUnityOfMesurment:"",
    }
    
    this.ActivateNewMatComp=true;

  }

  addClick(item: any){
    this.mat=item;
    this.ActivateAddMatComp=true;
  }

  showProvider(item: any){
    this.ActivateProvider=true;
    this.mat=item;
  
  }


  removeClick(item: any){
    this.mat=item;
    this.ActivateRemoveMatComp=true;
  }

  deleteClick(item: { MaterialId: any; }){
    if(confirm('Are you sure??')){
      this.service.deleteMaterial(item.MaterialId).subscribe(data=>{
        alert(data.toString());
        this.refreshMatList();
      })
    }
  }



  closeClick(){
    this.refreshMatList();
    this.ActivateNewMatComp=false;
    this.ActivateAddMatComp=false;
    this.ActivateRemoveMatComp=false;
    this.ActivateProvider=false;
    this.refreshMatList();
  }

  refreshMatList(){
    this.service.getMatList().subscribe(data=>{
      this.MaterialList=data;
      this.MaterialListWithoutFilter=data;

    });

  }

  FilterFn(){
    var MaterialIdFilter = this.MaterialIdFilter;
    var MaterialNameFilter = this.MaterialNameFilter;

    this.MaterialList = this.MaterialListWithoutFilter.filter(function (el: { MaterialId: 
      { toString: () => string; }; MaterialName: { toString: () => string; }; }){
      return el.MaterialId.toString().toLowerCase().includes(
        MaterialIdFilter.toString().trim().toLowerCase()
      )&&
      el.MaterialName.toString().toLowerCase().includes(
      MaterialNameFilter.toString().trim().toLowerCase()
      )
    });
  }



filedownload2(){
  alert(this.MaterialList.lenght)
  var options = { 
    fieldSeparator: ',',
    quoteStrings: '"',
    decimalseparator: '.',
    showLabels: true, 
    showTitle: true,
    title: 'Report Materiale',
    useBom: true,
    headers: [" MaterialId", "MaterialName", "Quantity", "Amount" , "MaterialLocation", "OneUnity", "UnityOfMesurment", "TypeOfUnityOfMesurment"]
  };
 
  new ngxCsv(this.MaterialList, "materiale", options);
}
}

