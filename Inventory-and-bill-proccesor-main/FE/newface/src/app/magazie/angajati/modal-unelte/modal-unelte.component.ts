import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-modal-unelte',
  templateUrl: './modal-unelte.component.html',
  styleUrls: ['./modal-unelte.component.css']
})
export class ModalUnelteComponent implements OnInit {

  constructor(private router: Router, private service:SharedService) { }
  
  ToolList:any=[];
  btntype:string="";
  mainlocation:any=[];


  ngOnInit(): void {
 
    this.refreshTolList();
    this.btntype = "btn-success";


    
  }


  refreshTolList(){
    this.service.getTolList().subscribe(data=>{
      this.ToolList=data;

      this.mainlocation=this.ToolList.MainLocation;
    });

    if(this.mainlocation == "Magazie"){
      this.btntype = "btn-warning";
    }else{
      this.btntype = "btn-success";
    }
  }

}
