import { Component, OnInit} from '@angular/core';
import { Router } from '@angular/router';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';


@Component({
  selector: 'app-materiale',
  templateUrl: './materiale.component.html',
  styleUrls: ['./materiale.component.css']
})
export class MaterialeComponent implements OnInit {

  constructor(private service:SharedService,private router: Router, private datePipe: DatePipe) { }


  MaterialId!: string;
  MaterialName!: string;
  Quantity!: bigint;
  Amount!: bigint;
  MaterialLocation!: string;
  UnityOfMesurment!: string;
  NewQuantity!: bigint;
  Provider!: string;
  DateOfGiving!:any;
  BucketDate!: Date;
  OneUnity!: bigint;
  TypeOfUnityOfMesurment!: string;



  ngOnInit(): void {
    this.refreshMatList()
    this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));



  }

  ToolList:any=[];
  ToolListmain:any=[];
  ToolListWithoutFilter:any=[];
  





  seeMagazie(){
    this.router.navigateByUrl('/magazie')
  }
  seeAngajati(){
    this.router.navigateByUrl('/angajati')
  }
  seeMateriale(){
    this.router.navigateByUrl('/materiale')
  }
  seeUnelte(){
    this.router.navigateByUrl('/unelte')
  }
  seeSchela(){
    this.router.navigateByUrl('/schela')
  }
  seeIstoric(){
    this.router.navigateByUrl('/history')
  }

  refreshMatList(){


    this.service.getMatList().subscribe(data=>{
      this.ToolList=data;
      this.ToolListWithoutFilter=data;
    });
  }

  deleteClick(item: { MaterialId: any; }){
    
      this.service.deleteMaterial(item.MaterialId).subscribe(data=>{
        console.log(data.toString());
        this.refreshMatList();
      })
    
  }


  addUser(){

    var val = {MaterialId:this.MaterialId,
              MaterialName:this.MaterialName,
              Quantity:this.Quantity,
              Amount:"1",
              MaterialLocation:"Magazie",   

              DateOfGiving:this.DateOfGiving,
              Provider:"1",
              OneUnity:"1",
              UnityOfMesurment:"1",
              TypeOfUnityOfMesurment:this.TypeOfUnityOfMesurment,};
    this.service.addMaterial(val).subscribe(res=>{
      console.log (res.toString());

    });
  }
}
