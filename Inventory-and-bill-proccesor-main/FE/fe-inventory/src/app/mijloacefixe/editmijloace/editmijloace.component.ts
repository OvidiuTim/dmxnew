import { Component, OnInit , Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-editmijloace',
  templateUrl: './editmijloace.component.html',
  styleUrls: ['./editmijloace.component.css']
})
export class EditmijloaceComponent implements OnInit {

  constructor(private service:SharedService, private datePipe: DatePipe) { }
  @Input() cme:any;
  MijloaceFixeId!: string;
  MijloaceFixeName!: string;
  MijloaceFixeCantitate!: bigint;
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
    this.MijloaceFixeId=this.cme.MijloaceFixeId;
    this.MijloaceFixeName=this.cme.MijloaceFixeName;
    this.MijloaceFixeCantitate=this.cme.MijloaceFixeCantitate;


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
    this.CofrajMetalicCantitateLEFT = Number.parseInt(this.MijloaceFixeCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
    var val = {MijloaceFixeId:this.MijloaceFixeId,
               MijloaceFixeName:this.MijloaceFixeName,
               MijloaceFixeCantitate:this.CofrajMetalicCantitateTOGIVE,
               Location:this.Location,
                };
    this.service.addmijloace(val).subscribe(res=>{
       (res.toString());
    });
    if(this.CofrajMetalicCantitateLEFT > 0){
      this.Location = "Magazie"
      var val1 = {MijloaceFixeId:this.MijloaceFixeId,
        MijloaceFixeName:this.MijloaceFixeName,
        MijloaceFixeCantitate:this.CofrajMetalicCantitateLEFT,
        Location:this.Location,
         };
        this.service.updatemijloace(val1).subscribe(res=>{
          (res.toString());});
    }
    else{
      this.service.deleteMijloace(val.MijloaceFixeId).subscribe(data=>{
        (data.toString());
      })
    }
  }

    /* AICI preluare de la ANGAJAT */
    takeCofrajFromWorker(){
      this.Location=this.cme.Location;
      if(this.CheckUser==this.Location){
        this.CofrajMetalicCantitateLEFT = Number.parseInt(this.MijloaceFixeCantitate.toString()) - Number.parseFloat(this.CofrajMetalicCantitateTOGIVE.toString());
        
        this.Location="Magazie"
        var val = {MijloaceFixeId:this.MijloaceFixeId,
          MijloaceFixeName:this.MijloaceFixeName,
          MijloaceFixeCantitate:this.CofrajMetalicCantitateTOGIVE,
          Location:this.Location,
          };
          this.service.addmijloace(val).subscribe(res=>{
            (res.toString());
          });
        
          if(this.CofrajMetalicCantitateLEFT == 0){
            this.service.deleteMijloace(val.MijloaceFixeId).subscribe(data=>{
              (data.toString());
            })
          }
          else{
            var val1 = {MijloaceFixeId:this.MijloaceFixeId,
              MijloaceFixeName:this.MijloaceFixeName,
              MijloaceFixeCantitate:this.CofrajMetalicCantitateLEFT,
              Location:this.CheckUser,
              };
              this.service.updatemijloace(val1).subscribe(res=>{
                (res.toString());});
          }}
        else{
          ("utilizatorii nu se potrivesc")
        }
    
    }


}
