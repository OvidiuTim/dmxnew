import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-addcolajtipdoka',
  templateUrl: './addcolajtipdoka.component.html',
  styleUrls: ['./addcolajtipdoka.component.css']
})
export class AddcolajtipdokaComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  CofrajtTipDokaId!: string;
  CofrajtTipDokaName!: string;
  CofrajtTipDokaCantitate!: bigint;
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
    this.CofrajtTipDokaId=this.cme.CofrajtTipDokaId;
    this.CofrajtTipDokaName=this.cme.CofrajtTipDokaName;
    this.CofrajtTipDokaCantitate=this.cme.CofrajtTipDokaCantitate;
    this.Location=this.cme.Location;


  }

  adaugaCofraj(){
    this.ActivateNewCofraj = true;
    this.ActivateGiveCofraj = false;
    this.ActivateTakeCofraj = false;
  }



  addCofrajmetalic(){
    this.Location = "Magazie"
    var val = {CofrajtTipDokaId:this.CofrajtTipDokaId,
               CofrajtTipDokaName:this.CofrajtTipDokaName,
               CofrajtTipDokaCantitate:this.CofrajtTipDokaCantitate,
               Location:this.Location,
                };
    this.service.addDoka(val).subscribe(res=>{
       (res.toString());

    });
  }
}