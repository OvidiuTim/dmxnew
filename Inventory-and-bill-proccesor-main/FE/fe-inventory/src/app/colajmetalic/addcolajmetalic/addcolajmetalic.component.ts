import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-addcolajmetalic',
  templateUrl: './addcolajmetalic.component.html',
  styleUrls: ['./addcolajmetalic.component.css']
})
export class AddcolajmetalicComponent implements OnInit {



  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  CofrajMetalicId!: string;
  CofrajMetalicName!: string;
  CofrajMetalicCantitate!: bigint;
  CofrajMetalicCantitateTOGIVE!: bigint;
  CofrajMetalicCantitateLEFT!: number;

  Location!: string;

  ActivateNewCofraj:boolean=true;
  ActivateGiveCofraj:boolean=false;
  ActivateTakeCofraj:boolean=false;

  DateSchela!:any;
  BucketDate!: Date;
  HistoriesScheleId!: string;
  SchelaName!: string;
  UserName!: string;
  CombustibilCantitate!: string;


  ngOnInit(): void {
    this.BucketDate = new Date();
    this.DateSchela = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    this.CofrajMetalicId=this.cme.CofrajMetalicId;
    this.CofrajMetalicName=this.cme.MaterialName;
    this.CofrajMetalicCantitate=this.cme.Quantity;
    this.Location=this.cme.Location;


  }

  adaugaCofraj(){
    this.ActivateNewCofraj = true;
    this.ActivateGiveCofraj = false;
    this.ActivateTakeCofraj = false;
  }



  addCofrajmetalic(){
    this.Location = "Magazie"
    var val = {CofrajMetalicId:this.CofrajMetalicId,
               CofrajMetalicName:this.CofrajMetalicName,
               CofrajMetalicCantitate:this.CofrajMetalicCantitate,
               Location:this.Location,
                };
    this.service.addCofMet(val).subscribe(res=>{
       (res.toString());

    });
  }

}