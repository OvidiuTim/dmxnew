import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-modal-schela',
  templateUrl: './modal-schela.component.html',
  styleUrls: ['./modal-schela.component.css']
})
export class ModalSchelaComponent implements OnInit {

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
