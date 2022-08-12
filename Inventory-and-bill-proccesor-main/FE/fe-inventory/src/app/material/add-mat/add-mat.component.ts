import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-add-mat',
  templateUrl: './add-mat.component.html',
  styleUrls: ['./add-mat.component.css']
})
export class AddMatComponent implements OnInit {

  constructor(private service:SharedService,  private datePipe: DatePipe) { }
  @Input() mat:any;
  
  MaterialId!: string;
  MaterialName!: string;
  AddAmount!: bigint;
  MaterialLocation!: string;
  WhatType!: string;

  NameOfMaterial!: string;
  NewAmount!: Number;
  AddQuantity!: bigint;
  NewQuantity!: Number;
  Quantity!: Number;
  Amount!: bigint;
  ConsumeId!:string;
  DateOfGiving!:any;
  BucketDate!: Date;
  UsersList:any=[];
  OneUnity!: bigint;
  Give!: string;
  TypeOfUnityOfMesurment!: string;
  UnityOfMesurment!: string;

  Provider!: string;
  
  ActivateAlert:boolean=false;
  ActivateModal:boolean=true;

  ActivateMinusKg:boolean=false;
  ActivatlMinusPiece:boolean=true;
  Amounte = 0;
  AmountList:any=[];
  Quantitye = 0;
  QuantityList:any=[];


  ngOnInit(): void {
    this.service.getAllUserNames().subscribe((data:any)=>{
      this.UsersList=data;
      });

      this.BucketDate = new Date();
      this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    
      this.MaterialId=this.mat.MaterialId;

      this.MaterialName=this.mat.MaterialName;
      this.Quantity=this.mat.Quantity;
      this.Amount=this.mat.Amount;


      this.DateOfGiving=this.mat.DateOfGiving;
      this.Provider=this.mat.Provider;
      this.OneUnity=this.mat.OneUnity;
      this.UnityOfMesurment=this.mat.UnityOfMesurment;

      this.TypeOfUnityOfMesurment=this.mat.TypeOfUnityOfMesurment;
    this.takeMatName();

    while(this.Amounte < this.Amount)
    {
      console.log(this.Amounte)
      this.Amounte ++;
      this.AmountList.push(this.Amounte)
    }
    
    while(this.Quantitye < this.Quantity)
    {
      this.Quantitye ++;
      this.QuantityList.push(this.Quantitye)
    }
  
  }

  takeMatName(){
    this.NameOfMaterial = this.MaterialName;
  }

  MinusPiece(){
    this.ActivatlMinusPiece = true;
    this.ActivateMinusKg = false;
  }
  MinusKg(){
    this.ActivateMinusKg = true;
    this.ActivatlMinusPiece = false;
  }

  addBucByPiece(){
    this.NewAmount = Number.parseInt(this.AddAmount.toString()) + Number.parseFloat(this.Amount.toString());
    this.NewQuantity = Number.parseInt(this.AddAmount.toString()) * Number.parseInt(this.OneUnity.toString()) + Number.parseFloat(this.Quantity.toString()); 
  }


  alertFinishChange(){
    this.ActivateAlert = true;
    this.ActivateModal = false;
  }


  addConsumable(){
    
    this.Give = " a adus "
    var val = {ConsumeId:this.ConsumeId,
      User:this.MaterialLocation,
      Material:this.MaterialName,
      MaterialSerie:this.WhatType,
      DateOfGiving:this.DateOfGiving,
      MaterialAmount:this.AddAmount,
      GiveRecive:this.Give,}
      
      this.service.addConsumable(val).subscribe(res=>{
        alert(res.toString());});
  }


  updateMaterialByPiece(){
    this.WhatType = this.UnityOfMesurment,
    this.createDate();
    this.addConsumable();
    this.addBucByPiece();
    var val = {MaterialId:this.MaterialId,
              MaterialName:this.MaterialName,
              Quantity:this.NewQuantity,
              Amount:this.NewAmount,
              MaterialLocation:this.MaterialLocation,   
              };

      this.service.updateMaterial(val).subscribe(res=>{
      (res.toString());
      });
      
      this.alertFinishChange();
    
      }



  addKgByKg(){
    this.NewQuantity = Number.parseInt(this.Quantity.toString()) + Number.parseFloat(this.AddQuantity.toString());
    this.NewAmount = (Math.ceil( Number.parseInt(this.NewQuantity.toString()) / Number.parseFloat(this.OneUnity.toString()) )); 
  }

  createDate(){
    this.BucketDate = new Date();
    this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
  }


  
  addConsumablebykg(){
    this.WhatType = this.TypeOfUnityOfMesurment
    this.Give = " a adus "
    var val = {ConsumeId:this.ConsumeId,
      User:this.MaterialLocation,
      Material:this.MaterialName,
      MaterialSerie:this.UnityOfMesurment,
      DateOfGiving:this.DateOfGiving,
      MaterialAmount:this.AddQuantity,
      GiveRecive:this.Give,}
      this.service.addConsumable(val).subscribe(res=>{
        alert(res.toString());});
  }
      
  updateMaterialByKg(){
    this.addKgByKg()
    this.createDate();
    var val = {MaterialId:this.MaterialId,
      MaterialName:this.MaterialName,
      Quantity:this.NewQuantity,
      Amount:this.NewAmount,
      MaterialLocation:this.MaterialLocation,   
      };

this.service.updateMaterial(val).subscribe(res=>{
  alert(res.toString());
});
this.addConsumablebykg();
this.alertFinishChange();

}

    

}
