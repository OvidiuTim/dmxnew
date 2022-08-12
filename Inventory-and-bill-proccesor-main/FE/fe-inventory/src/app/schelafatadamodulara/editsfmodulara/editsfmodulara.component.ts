import {Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-editsfmodulara',
  templateUrl: './editsfmodulara.component.html',
  styleUrls: ['./editsfmodulara.component.css']
})
export class EditsfmodularaComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  SchelaFatadaModularaId!: string;
  SchelaFatadaModularaName!: string;
  SchelaFatadaModularaCantitate!: bigint;
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
    this.SchelaFatadaModularaId=this.cme.SchelaFatadaModularaId;
    this.SchelaFatadaModularaName=this.cme.SchelaFatadaModularaName;
    this.SchelaFatadaModularaCantitate=this.cme.SchelaFatadaModularaCantitate;


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
    this.CofrajMetalicCantitateLEFT = Number.parseInt(this.SchelaFatadaModularaCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
    var val = {SchelaFatadaModularaId:this.SchelaFatadaModularaId,
               SchelaFatadaModularaName:this.SchelaFatadaModularaName,
               SchelaFatadaModularaCantitate:this.CofrajMetalicCantitateTOGIVE,
               Location:this.Location,
                };
    this.service.addschelafatadaM(val).subscribe(res=>{
       (res.toString());
    });
    if(this.CofrajMetalicCantitateLEFT > 0){
      this.Location = "Magazie"
      var val1 = {SchelaFatadaModularaId:this.SchelaFatadaModularaId,
        SchelaFatadaModularaName:this.SchelaFatadaModularaName,
        SchelaFatadaModularaCantitate:this.CofrajMetalicCantitateLEFT,
        Location:this.Location,
         };
        this.service.updateschelafatadaM(val1).subscribe(res=>{
          (res.toString());});
    }
    else{
      this.service.deleteschelafatadaM(val.SchelaFatadaModularaId).subscribe(data=>{
        (data.toString());
      })
    }
  }

    /* AICI preluare de la ANGAJAT */
    takeCofrajFromWorker(){
      this.Location=this.cme.Location;
      if(this.CheckUser==this.Location){
        this.CofrajMetalicCantitateLEFT = Number.parseInt(this.SchelaFatadaModularaCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
        
        this.Location="Magazie"
        var val = {SchelaFatadaModularaId:this.SchelaFatadaModularaId,
          SchelaFatadaModularaName:this.SchelaFatadaModularaName,
          SchelaFatadaModularaCantitate:this.CofrajMetalicCantitateTOGIVE,
          Location:this.Location,
          };
          this.service.addschelafatadaM(val).subscribe(res=>{
            (res.toString());
          });
        
          if(this.CofrajMetalicCantitateLEFT == 0){
            this.service.deleteschelafatadaM(val.SchelaFatadaModularaId).subscribe(data=>{
              (data.toString());
            })
          }
          else{
            var val1 = {SchelaFatadaModularaId:this.SchelaFatadaModularaId,
              SchelaFatadaModularaName:this.SchelaFatadaModularaName,
              SchelaFatadaModularaCantitate:this.CofrajMetalicCantitateLEFT,
              Location:this.CheckUser,
              };
              this.service.updateschelafatadaM(val1).subscribe(res=>{
                (res.toString());});
          }}
        else{
          ("utilizatorii nu se potrivesc")
        }
    
    }


}
