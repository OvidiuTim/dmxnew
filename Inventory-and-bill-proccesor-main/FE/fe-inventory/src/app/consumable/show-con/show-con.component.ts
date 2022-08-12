import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-show-con',
  templateUrl: './show-con.component.html',
  styleUrls: ['./show-con.component.css']
})
export class ShowConComponent implements OnInit {

  constructor(private service:SharedService) { }

  ConsumableList:any=[];
  
  ngOnInit(): void {
    this.refreshConList();
  }

  deleteClick(item: { ConsumeId: any; }){

      this.service.deleteConsumable(item.ConsumeId).subscribe(data=>{
        (data.toString());
        this.refreshConList();
      })
    
  }



  refreshConList(){
    this.service.getConList().subscribe(data=>{
      this.ConsumableList=data;
       });
  }

}