import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-remove-mat',
  templateUrl: './remove-mat.component.html',
  styleUrls: ['./remove-mat.component.css']
})
export class RemoveMatComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() mat:any;

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

  ngOnInit(): void {
    this.service.getAllUserNames().subscribe((data:any)=>{
    this.UsersList=data;
    });

    this.MaterialId=this.mat.MaterialId;
    this.MaterialName=this.mat.MaterialName;
    this.Quantity=this.mat.Quantity;
    this.Amount=this.mat.Amount;
    this.DateOfGiving=this.mat.DateOfGiving;
    this.Provider=this.mat.Provider;
    this.OneUnity=this.mat.OneUnity;
    this.UnityOfMesurment=this.mat.UnityOfMesurment;
    this.TypeOfUnityOfMesurment=this.mat.TypeOfUnityOfMesurment;
    this.takeFirstRow()

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

  alertFinishChange(){
    this.ActivateAlert = true;
    this.ActivateModal = false;
  }

  MinusPiece(){
    this.ActivatlMinusPiece = true;
    this.ActivateMinusKg = false;
  }
  MinusKg(){
    this.ActivateMinusKg = true;
    this.ActivatlMinusPiece = false;
  }

  takeFirstRow(){
    this.NameOfMaterial = this.mat.MaterialName
  }

  RemoveBuc(){
    this.NewAmount =Number.parseInt(this.Amount.toString()) - Number.parseFloat(this.RemoveAmount.toString());
    this.NewQuantity = Number.parseInt(this.Quantity.toString()) - (Number.parseFloat(this.RemoveAmount.toString()) *  Number.parseInt(this.OneUnity.toString()));
  }





  addConsumable(){
    this.WhatType = this.UnityOfMesurment,
    this.Give = " a luat" 
    var val = {ConsumeId:this.ConsumeId,
      User:this.MaterialLocation,
      Material:this.MaterialName,
      MaterialSerie:this.WhatType,
      DateOfGiving:this.DateOfGiving,
      MaterialAmount:this.RemoveAmount,
      GiveRecive:this.Give};;
      this.service.addConsumable(val).subscribe(res=>{
        alert(res.toString());});
  }

  addConsumableByKg(){
    this.WhatType = this.TypeOfUnityOfMesurment
    this.Give = " a luat" 
    var val = {ConsumeId:this.ConsumeId,
      User:this.MaterialLocation,
      Material:this.MaterialName,
      MaterialSerie:this.WhatType,
      DateOfGiving:this.DateOfGiving,
      MaterialAmount:this.RemoveQuantity,
      GiveRecive:this.Give};;
      this.service.addConsumable(val).subscribe(res=>{
        alert(res.toString());});
  }

  
  checkPassword() {
    let selectedUser = this.UsersList.find((User:any) => {
      return User.UserName === this.MaterialLocation
    } )
    return selectedUser.UserPin === this.Pin
  }


  updateToolOne(){
    this.Pin = "1324";
    this.BucketDate = new Date();
    this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    this.RemoveBuc();
    var val = {MaterialId:this.MaterialId,

      MaterialName:this.MaterialName,
      Quantity:this.NewQuantity,
      Amount:this.NewAmount,
      MaterialLocation:this.MaterialLocation,};

      this.service.updateMaterial(val).subscribe(res=>{
        alert(res.toString());
      });
      this.addConsumable();
      this.alertFinishChange();;
  
    }

    RemoveKgByKg(){
      
      this.NewQuantity = Number.parseInt(this.Quantity.toString()) - Number.parseFloat(this.RemoveQuantity.toString());
      this.NewAmount = (Math.ceil( Number.parseInt(this.NewQuantity.toString()) / Number.parseFloat(this.OneUnity.toString()) )); 

       
    }

    updateToolTwo(){
      this.Pin = "1324";
      this.BucketDate = new Date();
      this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
      this.RemoveKgByKg();
      var val = {MaterialId:this.MaterialId,
        MaterialName:this.MaterialName,
        Quantity:this.NewQuantity,
        Amount:this.NewAmount,
        MaterialLocation:this.MaterialLocation,};
  
        this.service.updateMaterial(val).subscribe(res=>{
        alert(res.toString());
        });
        this.addConsumableByKg();
        this.alertFinishChange();;
        }

}
