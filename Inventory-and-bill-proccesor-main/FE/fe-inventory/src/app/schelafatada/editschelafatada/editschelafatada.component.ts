import {Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-editschelafatada',
  templateUrl: './editschelafatada.component.html',
  styleUrls: ['./editschelafatada.component.css']
})
export class EditschelafatadaComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  SchelaFatadaId!: string;
  SchelaFatadaName!: string;
  SchelaFatadaCantitate!: bigint;
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
    this.SchelaFatadaId=this.cme.SchelaFatadaId;
    this.SchelaFatadaName=this.cme.SchelaFatadaName;
    this.SchelaFatadaCantitate=this.cme.SchelaFatadaCantitate;


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
    this.CofrajMetalicCantitateLEFT = Number.parseInt(this.SchelaFatadaCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
    var val = {SchelaFatadaId:this.SchelaFatadaId,
               SchelaFatadaName:this.SchelaFatadaName,
               SchelaFatadaCantitate:this.CofrajMetalicCantitateTOGIVE,
               Location:this.Location,
                };
    this.service.addschelafatada(val).subscribe(res=>{
       (res.toString());
    });
    if(this.CofrajMetalicCantitateLEFT > 0){
      this.Location = "Magazie"
      var val1 = {SchelaFatadaId:this.SchelaFatadaId,
        SchelaFatadaName:this.SchelaFatadaName,
        SchelaFatadaCantitate:this.CofrajMetalicCantitateLEFT,
        Location:this.Location,
         };
        this.service.updateschelafatada(val1).subscribe(res=>{
          (res.toString());});
    }
    else{
      this.service.deleteschelafatada(val.SchelaFatadaId).subscribe(data=>{
        (data.toString());
      })
    }
  }

    /* AICI preluare de la ANGAJAT */
    takeCofrajFromWorker(){
      this.Location=this.cme.Location;
      if(this.CheckUser==this.Location){
        this.CofrajMetalicCantitateLEFT = Number.parseInt(this.SchelaFatadaCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
        
        this.Location="Magazie"
        var val = {SchelaFatadaId:this.SchelaFatadaId,
          SchelaFatadaName:this.SchelaFatadaName,
          SchelaFatadaCantitate:this.CofrajMetalicCantitateTOGIVE,
          Location:this.Location,
          };
          this.service.addschelafatada(val).subscribe(res=>{
            (res.toString());
          });
        
          if(this.CofrajMetalicCantitateLEFT == 0){
            this.service.deleteschelafatada(val.SchelaFatadaId).subscribe(data=>{
              (data.toString());
            })
          }
          else{
            var val1 = {SchelaFatadaId:this.SchelaFatadaId,
              SchelaFatadaName:this.SchelaFatadaName,
              SchelaFatadaCantitate:this.CofrajMetalicCantitateLEFT,
              Location:this.CheckUser,
              };
              this.service.updateschelafatada(val1).subscribe(res=>{
                (res.toString());});
          }}
        else{
          ("utilizatorii nu se potrivesc")
        }
    
    }


}
