import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-add-popi',
  templateUrl: './add-popi.component.html',
  styleUrls: ['./add-popi.component.css']
})
export class AddPopiComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  PopiDokaId!: string;
  PopiName!: string;
  PopiCantitate!: bigint;
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



  ngOnInit(): void {
    this.BucketDate = new Date();
    this.DateSchela = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    this.PopiDokaId=this.cme.PopiDokaId;
    this.PopiName=this.cme.PopiName;
    this.PopiCantitate=this.cme.PopiCantitate;
    this.Location=this.cme.Location;


  }

  adaugaCofraj(){
    this.ActivateNewCofraj = true;
    this.ActivateGiveCofraj = false;
    this.ActivateTakeCofraj = false;
  }


  ActivateAlert:boolean=false;
  addCofrajmetalic(){
    this.ActivateNewCofraj = false;
    this.ActivateAlert = true;
    this.Location = "Magazie"
    var val = {PopiDokaId:this.PopiDokaId,
               PopiName:this.PopiName,
               PopiCantitate:this.PopiCantitate,
               Location:this.Location,
                };
    this.service.addpopi(val).subscribe(res=>{
       (res.toString());

    });
  }
}