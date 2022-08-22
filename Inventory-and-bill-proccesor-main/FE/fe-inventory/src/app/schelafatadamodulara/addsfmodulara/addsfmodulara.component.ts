import { Component, OnInit , Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-addsfmodulara',
  templateUrl: './addsfmodulara.component.html',
  styleUrls: ['./addsfmodulara.component.css']
})
export class AddsfmodularaComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  SchelaFatadaModularaId!: string;
  SchelaFatadaModularaName!: string;
  SchelaFatadaModularaCantitate!: bigint;
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
    this.SchelaFatadaModularaId=this.cme.SchelaFatadaModularaId;
    this.SchelaFatadaModularaName=this.cme.SchelaFatadaModularaName;
    this.SchelaFatadaModularaCantitate=this.cme.SchelaFatadaModularaCantitate;
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
    this.ActivateAlert = true;    this.Location = "Magazie"
    var val = {SchelaFatadaModularaId:this.SchelaFatadaModularaId,
               SchelaFatadaModularaName:this.SchelaFatadaModularaName,
               SchelaFatadaModularaCantitate:this.SchelaFatadaModularaCantitate,
               Location:this.Location,
                };
    this.service.addschelafatadaM(val).subscribe(res=>{
       (res.toString());

    });
  }
}