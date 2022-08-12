import {Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-editcolajtipdoka',
  templateUrl: './editcolajtipdoka.component.html',
  styleUrls: ['./editcolajtipdoka.component.css']
})
export class EditcolajtipdokaComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  CofrajtTipDokaId!: string;
  CofrajtTipDokaName!: string;
  CofrajtTipDokaCantitate!: bigint;
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
    this.CofrajtTipDokaId=this.cme.CofrajtTipDokaId;
    this.CofrajtTipDokaName=this.cme.CofrajtTipDokaName;
    this.CofrajtTipDokaCantitate=this.cme.CofrajtTipDokaCantitate;


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
    this.CofrajMetalicCantitateLEFT = Number.parseInt(this.CofrajtTipDokaCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
    var val = {CofrajtTipDokaId:this.CofrajtTipDokaId,
               CofrajtTipDokaName:this.CofrajtTipDokaName,
               CofrajtTipDokaCantitate:this.CofrajMetalicCantitateTOGIVE,
               Location:this.Location,
                };
    this.service.addDoka(val).subscribe(res=>{
       (res.toString());
    });
    if(this.CofrajMetalicCantitateLEFT > 0){
      this.Location = "Magazie"
      var val1 = {CofrajtTipDokaId:this.CofrajtTipDokaId,
        CofrajtTipDokaName:this.CofrajtTipDokaName,
        CofrajtTipDokaCantitate:this.CofrajMetalicCantitateLEFT,
        Location:this.Location,
         };
        this.service.updateDoka(val1).subscribe(res=>{
          (res.toString());});
    }
    else{
      this.service.deleteDoka(val.CofrajtTipDokaId).subscribe(data=>{
        (data.toString());
      })
    }
  }

    /* AICI preluare de la ANGAJAT */
    takeCofrajFromWorker(){
      this.Location=this.cme.Location;
      if(this.CheckUser==this.Location){
        this.CofrajMetalicCantitateLEFT = Number.parseInt(this.CofrajtTipDokaCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
        
        this.Location="Magazie"
        var val = {CofrajtTipDokaId:this.CofrajtTipDokaId,
          CofrajtTipDokaName:this.CofrajtTipDokaName,
          CofrajtTipDokaCantitate:this.CofrajMetalicCantitateTOGIVE,
          Location:this.Location,
          };
          this.service.addDoka(val).subscribe(res=>{
            (res.toString());
          });
        
          if(this.CofrajMetalicCantitateLEFT == 0){
            this.service.deleteDoka(val.CofrajtTipDokaId).subscribe(data=>{
              (data.toString());
            })
          }
          else{
            var val1 = {CofrajtTipDokaId:this.CofrajtTipDokaId,
              CofrajtTipDokaName:this.CofrajtTipDokaName,
              CofrajtTipDokaCantitate:this.CofrajMetalicCantitateLEFT,
              Location:this.CheckUser,
              };
              this.service.updateDoka(val1).subscribe(res=>{
                (res.toString());});
          }}
        else{
          ("utilizatorii nu se potrivesc")
        }
    
    }


}
