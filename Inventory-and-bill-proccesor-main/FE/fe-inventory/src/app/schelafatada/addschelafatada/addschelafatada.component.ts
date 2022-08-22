import { Component, OnInit , Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';
@Component({
  selector: 'app-addschelafatada',
  templateUrl: './addschelafatada.component.html',
  styleUrls: ['./addschelafatada.component.css']
})
export class AddschelafatadaComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  SchelaFatadaId!: string;
  SchelaFatadaName!: string;
  SchelaFatadaCantitate!: bigint;
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
    this.SchelaFatadaId=this.cme.SchelaFatadaId;
    this.SchelaFatadaName=this.cme.SchelaFatadaName;
    this.SchelaFatadaCantitate=this.cme.SchelaFatadaCantitate;
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
    var val = {SchelaFatadaId:this.SchelaFatadaId,
               SchelaFatadaName:this.SchelaFatadaName,
               SchelaFatadaCantitate:this.SchelaFatadaCantitate,
               Location:this.Location,
                };
    this.service.addschelafatada(val).subscribe(res=>{
       (res.toString());

    });
  }
}