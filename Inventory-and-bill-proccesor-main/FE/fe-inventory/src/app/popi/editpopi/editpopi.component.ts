import { Component, OnInit , Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-editpopi',
  templateUrl: './editpopi.component.html',
  styleUrls: ['./editpopi.component.css']
})
export class EditpopiComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  PopiDokaId!: string;
  PopiName!: string;
  PopiCantitate!: bigint;
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
    this.PopiDokaId=this.cme.PopiDokaId;
    this.PopiName=this.cme.PopiName;
    this.PopiCantitate=this.cme.PopiCantitate;


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
    this.CofrajMetalicCantitateLEFT = Number.parseInt(this.PopiCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
    var val = {PopiDokaId:this.PopiDokaId,
               PopiName:this.PopiName,
               PopiCantitate:this.CofrajMetalicCantitateTOGIVE,
               Location:this.Location,
                };
    this.service.addpopi(val).subscribe(res=>{
       (res.toString());
    });
    if(this.CofrajMetalicCantitateLEFT > 0){
      this.Location = "Magazie"
      var val1 = {PopiDokaId:this.PopiDokaId,
        PopiName:this.PopiName,
        PopiCantitate:this.CofrajMetalicCantitateLEFT,
        Location:this.Location,
         };
        this.service.updatepopi(val1).subscribe(res=>{
          (res.toString());});
    }
    else{
      this.service.deletepopi(val.PopiDokaId).subscribe(data=>{
        (data.toString());
      })
    }
  }

    /* AICI preluare de la ANGAJAT */
    takeCofrajFromWorker(){
      this.Location=this.cme.Location;
      if(this.CheckUser==this.Location){
        this.CofrajMetalicCantitateLEFT = Number.parseInt(this.PopiCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
        
        this.Location="Magazie"
        var val = {PopiDokaId:this.PopiDokaId,
          PopiName:this.PopiName,
          PopiCantitate:this.CofrajMetalicCantitateTOGIVE,
          Location:this.Location,
          };
          this.service.addpopi(val).subscribe(res=>{
            (res.toString());
          });
        
          if(this.CofrajMetalicCantitateLEFT == 0){
            this.service.deletepopi(val.PopiDokaId).subscribe(data=>{
              (data.toString());
            })
          }
          else{
            var val1 = {PopiDokaId:this.PopiDokaId,
              PopiName:this.PopiName,
              PopiCantitate:this.CofrajMetalicCantitateLEFT,
              Location:this.CheckUser,
              };
              this.service.updatepopi(val1).subscribe(res=>{
                (res.toString());});
          }}
        else{
          ("utilizatorii nu se potrivesc")
        }
    
    }


}
