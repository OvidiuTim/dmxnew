import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';


@Component({
  selector: 'app-new-mat',
  templateUrl: './new-mat.component.html',
  styleUrls: ['./new-mat.component.css'],
  providers: [DatePipe]
})
export class NewMatComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() mat:any;

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

  TypeOfUnityOfMesurment!: string;
  


  OneUnity!: bigint;

  

  ActivateAlert:boolean=false;
  ActivateModal:boolean=true;

  StillNext:boolean=true;
  NoNext:boolean=false;

  OneOfTheAbove:boolean=true;
  AnotherOption:boolean=false;

  
  ngOnInit(): void {
    this.BucketDate = new Date();
    this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    this.MaterialId=this.mat.MaterialId;
    this.MaterialName=this.mat.MaterialName;
    this.Quantity=this.mat.Quantity;
    this.Amount=this.mat.Amount;
    this.MaterialLocation=this.mat.MaterialLocation;

    this.DateOfGiving=this.mat.DateOfGiving;
    this.Provider=this.mat.Provider;
    this.OneUnity=this.mat.OneUnity;
    this.UnityOfMesurment=this.mat.UnityOfMesurment;
    this.TypeOfUnityOfMesurment=this.mat.TypeOfUnityOfMesurmentr;
  }
  addKg(){
    this.Quantity = (this.OneUnity) * (this.Amount)
    
  }




firstNext(){
  this.StillNext=false;
  this.NoNext=true;
}

  alertFinishChange(){
    this.ActivateAlert = true;
    this.ActivateModal = false;
  }

  MakeLocation(){
    this.MaterialLocation = "Magazie"
  }

  choseAnotherOption(){
    this.AnotherOption = true;
    this.OneOfTheAbove = false;
  }

  


  addUser(){
    this.addKg()
    this.MakeLocation()
    var val = {MaterialId:this.MaterialId,
              MaterialName:this.MaterialName,
              Quantity:this.Quantity,
              Amount:this.Amount,
              MaterialLocation:this.MaterialLocation,   

              DateOfGiving:this.DateOfGiving,
              Provider:this.Provider,
              OneUnity:this.OneUnity,
              UnityOfMesurment:this.UnityOfMesurment,
              TypeOfUnityOfMesurment:this.TypeOfUnityOfMesurment,};
    this.service.addMaterial(val).subscribe(res=>{
      alert (res.toString());

    });
  }

}
