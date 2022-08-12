import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-service-operations',
  templateUrl: './service-operations.component.html',
  styleUrls: ['./service-operations.component.css']
})
export class ServiceOperationsComponent implements OnInit {

  constructor(private service:SharedService) { }

  @Input() unf:any;
  
  
  UnfunctionalId!: string;
  ToolSerie!: string;
  ToolName!: string;
  Detail!: string;
  Status!: string;
  Service!: string;
  Pieces!: Number;
  ActivateAlert:boolean=false;
  ActivateModal:boolean=true;



  ngOnInit(): void {
    
    this.UnfunctionalId=this.unf.UnfunctionalId;
    this.ToolSerie=this.unf.ToolSerie;
    this.ToolName=this.unf.ToolName;
    this.Detail=this.unf.Detail
    this.Status=this.unf.Status
    this.Service=this.unf.Service
    this.Pieces=this.unf.Pieces

    
    
  }

  alertFinishChange(){
    this.ActivateAlert = true;
    this.ActivateModal = false;
  }



    updateTool(){

      var val = {UnfunctionalId:this.UnfunctionalId,
        ToolSerie:this.ToolSerie,
        ToolName:this.ToolName,
        Detail:this.Detail,
        Service:this.Service,
        Status:this.Status,
        Pieces:this.Pieces};
  
        this.service.updateUnfunctional(val).subscribe(res=>{alert
        (res.toString());
        });
        this.alertFinishChange();
    }



}


