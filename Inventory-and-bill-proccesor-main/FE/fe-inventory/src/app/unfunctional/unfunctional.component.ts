import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-unfunctional',
  templateUrl: './unfunctional.component.html',
  styleUrls: ['./unfunctional.component.css']
})
export class UnfunctionalComponent implements OnInit {

  constructor(private service:SharedService) { }

  ServiceList:any=[];
  unf:any;
  ActivateToolToService:boolean = false;
  ActivateToolToShed:boolean = false;


  ngOnInit(): void {
    this.refreshUnfList();
    
  }

  toolToService(item: any){
    this.ActivateToolToService=true;
    this.unf=item;
  }

  toolToShed(item: any){
    this.ActivateToolToShed=true;
    this.unf=item;
  }

  closeClick(){
    this.ActivateToolToService=false;
    this.refreshUnfList();
  }

  deleteClick(item: { UnfunctionalId: any; }){
    if(confirm('Are you sure??')){
      this.service.deleteUnfunctional(item.UnfunctionalId).subscribe(data=>{
        alert(data.toString());
        this.refreshUnfList();
      })
    }
  }

  refreshUnfList(){
    this.service.getUnfunctList().subscribe(data=>{
      this.ServiceList=data;
    });
  }

}