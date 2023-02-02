import { Component, OnInit} from '@angular/core';
import { Router } from '@angular/router';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-modal-materiale',
  templateUrl: './modal-materiale.component.html',
  styleUrls: ['./modal-materiale.component.css']
})
export class ModalMaterialeComponent implements OnInit {

  constructor(private service:SharedService,private router: Router) { }

  ToolList:any=[];
  ToolListmain:any=[];
  ToolListWithoutFilter:any=[];

  tol:any=[];

  ToolLocationFilter:string="";
  ToolLocationFilterMagazie:string="";
  ToolNameFilter:string="";
  selectedUserSimple : any
  une:any;



  ngOnInit(): void {
    this.refreshMatList();
    //aduce userul aici
    this.selectedUserSimple = this.service.selectedUser
   

  }

  refreshMatList(){


      this.service.getMatList().subscribe(data=>{
        this.ToolList=data;
        this.ToolListWithoutFilter=data;

        
      });
    }


}
