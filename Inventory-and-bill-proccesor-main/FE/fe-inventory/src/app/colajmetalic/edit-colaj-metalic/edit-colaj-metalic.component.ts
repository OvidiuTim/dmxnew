import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-edit-colaj-metalic',
  templateUrl: './edit-colaj-metalic.component.html',
  styleUrls: ['./edit-colaj-metalic.component.css']
})
export class EditColajMetalicComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  CofrajMetalicId!: string;
  CofrajMetalicName!: string;
  CofrajMetalicCantitate!: bigint;
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
    this.CofrajMetalicId=this.cme.CofrajMetalicId;
    this.CofrajMetalicName=this.cme.CofrajMetalicName;
    this.CofrajMetalicCantitate=this.cme.CofrajMetalicCantitate;


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
    this.CofrajMetalicCantitateLEFT = Number.parseInt(this.CofrajMetalicCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
    var val = {CofrajMetalicId:this.CofrajMetalicId,
               CofrajMetalicName:this.CofrajMetalicName,
               CofrajMetalicCantitate:this.CofrajMetalicCantitateTOGIVE,
               Location:this.Location,
                };
    this.service.addCofMet(val).subscribe(res=>{
       (res.toString());
    });
    if(this.CofrajMetalicCantitateLEFT > 0){
      this.Location = "Magazie"
      var val1 = {CofrajMetalicId:this.CofrajMetalicId,
        CofrajMetalicName:this.CofrajMetalicName,
        CofrajMetalicCantitate:this.CofrajMetalicCantitateLEFT,
        Location:this.Location,
         };
        this.service.updateCofMet(val1).subscribe(res=>{
         (res.toString());});
    }
    else{
      this.service.deleteCofMet(val.CofrajMetalicId).subscribe(data=>{
        (data.toString());
      })
    }
  }

    /* AICI preluare de la ANGAJAT */
    takeCofrajFromWorker(){
      this.Location=this.cme.Location;
      if(this.CheckUser==this.Location){
        this.CofrajMetalicCantitateLEFT = Number.parseInt(this.CofrajMetalicCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
        
        this.Location="Magazie"
        var val = {CofrajMetalicId:this.CofrajMetalicId,
          CofrajMetalicName:this.CofrajMetalicName,
          CofrajMetalicCantitate:this.CofrajMetalicCantitateTOGIVE,
          Location:this.Location,
          };
          this.service.addCofMet(val).subscribe(res=>{
             (res.toString());
          });
        
          if(this.CofrajMetalicCantitateLEFT == 0){
            this.service.deleteCofMet(val.CofrajMetalicId).subscribe(data=>{
              (data.toString());
            })
          }
          else{
            var val1 = {CofrajMetalicId:this.CofrajMetalicId,
              CofrajMetalicName:this.CofrajMetalicName,
              CofrajMetalicCantitate:this.CofrajMetalicCantitateLEFT,
              Location:this.CheckUser,
              };
              this.service.updateCofMet(val1).subscribe(res=>{
               (res.toString());});
          }}
        else{
          ("utilizatorii nu se potrivesc")
        }
    
    }


}
