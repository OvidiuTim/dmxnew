import { Component, OnInit} from '@angular/core';
import { Router } from '@angular/router';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-modal-materiale',
  templateUrl: './modal-materiale.component.html',
  styleUrls: ['./modal-materiale.component.css']
})
export class ModalMaterialeComponent implements OnInit {

  constructor(private service:SharedService,private router: Router, private datePipe: DatePipe) { }

  ToolList:any=[];
  ToolListmain:any=[];
  ToolListWithoutFilter:any=[];

  tol:any=[];

  ToolLocationFilter:string="";
  ToolLocationFilterMagazie:string="";
  ToolNameFilter:string="";
  selectedUserSimple : any
  une:any;


  MaterialId!: string;
  MaterialName!: string;
  TypeOfUnityOfMesurment!: string;
  UnityOfMesurment!: string;
  MaterialLocation!: string;

  NameOfMaterial!: string;
  RemoveAmount!: Number;

  Provider!: string;
  NewAmount!:  Number;
  NewQuantity!:  Number;
  RemoveQuantity!:  Number;
  BucketOfAmount!:  Number;
  OneUnity!: Number;
  Amount!: Number;
  BucketQuantity!: Number;
  Quantity!: Number;
  DateOfGiving!:any;
  BucketDate!: Date;

  ConsumeId!:string;
  UsersList:any=[];
  Pin!: string;
  Give!: string;

  ActivateAlert:boolean=false;
  ActivateModal:boolean=true;

  ActivateMinusKg:boolean=false;
  ActivatlMinusPiece:boolean=true;
  WhatType!: string;
  Amounte = 0;
  AmountList:any=[];
  Quantitye = 0;
  QuantityList:any=[];

  ListMat:any=[];


  ngOnInit(): void {
    this.refreshMatList();
    //aduce userul aici
    this.selectedUserSimple = this.service.selectedUser
   
    this.BucketDate = new Date();


    this.MaterialLocation=this.selectedUserSimple.UserName
  }




  refreshMatList(){


      this.service.getMatList().subscribe(data=>{
        this.ToolList=data;
        this.ToolListWithoutFilter=data;
      });
    }


    modalunelte(item: any){
      this.ListMat=item;
  

      this.MaterialId=this.ListMat.MaterialId;
      this.MaterialName=this.ListMat.MaterialName;
      this.Quantity=this.ListMat.Quantity;
      this.Amount=this.ListMat.Amount;
      this.MaterialLocation="1"
      this.Provider=this.ListMat.Provider;
      this.DateOfGiving=this.ListMat.DateOfGiving;
      this.OneUnity=this.ListMat.OneUnity;
      this.UnityOfMesurment=this.ListMat.UnityOfMesurment;
      this.TypeOfUnityOfMesurment=this.ListMat.TypeOfUnityOfMesurment;

    }

    updateToolOne(){
      

      this.Pin = "1324";
      this.BucketDate = new Date();
      this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
      this.NewQuantity = Number.parseInt(this.Quantity.toString()) - (Number.parseFloat(this.RemoveQuantity.toString()))


      var val = {
          MaterialId:this.MaterialId,
          MaterialName:this.MaterialName,
          Quantity:this.NewQuantity,
          Amount:this.Amount,
          MaterialLocation:this.MaterialLocation
      };
  
        this.service.updateMaterial(val).subscribe(res=>{
          console.log(res.toString());
        });

        this.addConsumable();
        this.refreshMatList();

        this.RemoveQuantity=0;
      }


      addConsumable(){
        
        this.Give = " a luat" 
        var val = {ConsumeId:this.ConsumeId,
          User:this.MaterialLocation,
          Material:this.MaterialName,
          MaterialSerie:this.MaterialName,
          DateOfGiving:this.DateOfGiving,
          MaterialAmount:this.RemoveQuantity,
          GiveRecive:this.Give};;
          this.service.addConsumable(val).subscribe(res=>{
            console.log(res.toString());});
      }

}
