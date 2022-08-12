import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-editschelausoara',
  templateUrl: './editschelausoara.component.html',
  styleUrls: ['./editschelausoara.component.css']
})
export class EditschelausoaraComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  SchelaUsoaraId!: string;
  SchelaUsoaraName!: string;
  SchelaUsoaraCantitate!: bigint;
  cantitate!: bigint;
  listabucati!: any;
  CofrajMetalicCantitateTOGIVE!: bigint;
  CofrajMetalicCantitateLEFT!: number;

  Location!: string;
  CheckUser!: string;

  ActivateGiveCofraj:boolean=false;
  ActivateTakeCofraj:boolean=true;

  DateSchela!:any;
  BucketDate!: Date;
  HistoriesScheleId!: string;
  SchelaName!: string;
  UserName!: string;
  CombustibilCantitate!: string;


  ngOnInit(): void {
    this.BucketDate = new Date();
    this.DateSchela = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    this.SchelaUsoaraId=this.cme.SchelaUsoaraId;
    this.SchelaUsoaraName=this.cme.SchelaUsoaraName;
    this.SchelaUsoaraCantitate=this.cme.SchelaUsoaraCantitate;


  }

  preiaCofraj(){
    this.ActivateGiveCofraj = false;
    this.ActivateTakeCofraj = true;
  }

  predaCofraj(){
    this.ActivateGiveCofraj = true;
    this.ActivateTakeCofraj = false;
  }


  /* AICI PREDARE CATRE ANGAJAT */
  addCofrajmetalicTOWORKER(){
    this.CofrajMetalicCantitateLEFT = Number.parseInt(this.SchelaUsoaraCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
    var val = {SchelaUsoaraId:this.SchelaUsoaraId,
               SchelaUsoaraName:this.SchelaUsoaraName,
               SchelaUsoaraCantitate:this.SchelaUsoaraCantitate,
               Location:this.Location,
                };
    this.service.addschelausoara(val).subscribe(res=>{
       (res.toString());
    });
    if(this.CofrajMetalicCantitateLEFT > 0){
      this.Location = "Magazie"
      var val1 = {SchelaUsoaraId:this.SchelaUsoaraId,
        SchelaUsoaraName:this.SchelaUsoaraName,
        SchelaUsoaraCantitate:this.CofrajMetalicCantitateLEFT,
        Location:this.Location,
         };
        this.service.updateschelausoara(val1).subscribe(res=>{
          (res.toString());});
    }
    else{
      this.service.deleteschelausoara(val.SchelaUsoaraId).subscribe(data=>{
        (data.toString());
      })
    }
  }

    /* AICI preluare de la ANGAJAT */
    takeCofrajFromWorker(){
      this.Location=this.cme.Location;
      if(this.CheckUser==this.Location){
        this.CofrajMetalicCantitateLEFT = Number.parseInt(this.SchelaUsoaraCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
        
        this.Location="Magazie"
        var val = {SchelaUsoaraId:this.SchelaUsoaraId,
          SchelaUsoaraName:this.SchelaUsoaraName,
          SchelaUsoaraCantitate:this.CofrajMetalicCantitateTOGIVE,
          Location:this.Location,
          };
          this.service.addschelausoara(val).subscribe(res=>{
            (res.toString());
          });
        
          if(this.CofrajMetalicCantitateLEFT == 0){
            this.service.deleteschelausoara(val.SchelaUsoaraId).subscribe(data=>{
              (data.toString());
            })
          }
          else{
            var val1 = {SchelaUsoaraId:this.SchelaUsoaraId,
              SchelaUsoaraName:this.SchelaUsoaraName,
              SchelaUsoaraCantitate:this.CofrajMetalicCantitateLEFT,
              Location:this.CheckUser,
              };
              this.service.updateschelausoara(val1).subscribe(res=>{
                (res.toString());});
          }}
        else{
          ("utilizatorii nu se potrivesc")
        }
    
    }


}
