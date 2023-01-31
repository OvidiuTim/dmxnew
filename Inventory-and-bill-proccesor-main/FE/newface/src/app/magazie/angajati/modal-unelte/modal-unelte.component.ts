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
  ToolListWithoutFilter:any=[];


  ToolLocationFilter:string="";

  une:any;


  ngOnInit(): void {
    
    this.refreshTolList();

  }

  FilterFn(){
    
    var ToolLocationFilter = this.ToolLocationFilter;

    this.ToolList = this.ToolListWithoutFilter.filter(function (el: { ToolId: 
      { toString: () => string; }; MainLocation: { toString: () => string; }; }){
      return el.MainLocation.toString().toLowerCase().includes(
        ToolLocationFilter.toString().trim().toLowerCase()
      )
    });
  }


  refreshTolList(){
    this.ToolLocationFilter = 'BEGU EUGEN'
    var ToolLocationFilter = this.ToolLocationFilter;

    this.service.getTolList().subscribe(data=>{
      this.ToolList=data.filter(function (el: {MainLocation: 
        { toString: () => string; }; }) { 
          return el.MainLocation.toString().toLowerCase().includes(
            ToolLocationFilter.toString().trim().toLowerCase()
          ) 
        });

      this.ToolListWithoutFilter=data;

    });

  }

}
