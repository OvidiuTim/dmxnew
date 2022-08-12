import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-addschelausoara',
  templateUrl: './addschelausoara.component.html',
  styleUrls: ['./addschelausoara.component.css']
})
export class AddschelausoaraComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  SchelaFatadaId!: string;
  SchelaUsoaraName!: string;
  SchelaUsoaraCantitate!: bigint;
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
    this.SchelaUsoaraName=this.cme.SchelaUsoaraName;
    this.SchelaUsoaraCantitate=this.cme.SchelaUsoaraCantitate;
    this.Location=this.cme.Location;


  }

  adaugaCofraj(){
    this.ActivateNewCofraj = true;
    this.ActivateGiveCofraj = false;
    this.ActivateTakeCofraj = false;
  }



  addCofrajmetalic(){
    this.Location = "Magazie"
    var val = {SchelaFatadaId:this.SchelaFatadaId,
               SchelaUsoaraName:this.SchelaUsoaraName,
               SchelaUsoaraCantitate:this.SchelaUsoaraCantitate,
               Location:this.Location,
                };
    this.service.addschelausoara(val).subscribe(res=>{
       alert(res.toString());

    });
  }
}