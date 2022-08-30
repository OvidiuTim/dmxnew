import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';


@Component({
  selector: 'app-add-mijloace',
  templateUrl: './add-mijloace.component.html',
  styleUrls: ['./add-mijloace.component.css']
})
export class AddMijloaceComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  MijloaceFixeId!: string;
  MijloaceFixeName!: string;
  MijloaceFixeCantitate!: bigint;
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
    this.MijloaceFixeId=this.cme.MijloaceFixeId;
    this.MijloaceFixeName=this.cme.MijloaceFixeName;
    this.MijloaceFixeCantitate=this.cme.MijloaceFixeCantitate;
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
    var val = {MijloaceFixeId:this.MijloaceFixeId,
               MijloaceFixeName:this.MijloaceFixeName,
               MijloaceFixeCantitate:this.MijloaceFixeCantitate,
               Location:this.Location,
                };
    this.service.addmijloace(val).subscribe(res=>{
       (res.toString());

    });
  }
}