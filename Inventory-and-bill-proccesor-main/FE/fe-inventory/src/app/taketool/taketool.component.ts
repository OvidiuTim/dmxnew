import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-taketool',
  templateUrl: './taketool.component.html',
  styleUrls: ['./taketool.component.css']
})
export class TaketoolComponent implements OnInit {

constructor(private service:SharedService) { }
  
UserList:any=[];
ModalTitle:string | undefined;
ActivateAddEditUsrComp:boolean=false;
ActivateUrsHisComp:boolean=false;
usr:any;
use:any;
UserNameFilter:string="";
UserFilter:string="";
UserListWithoutFilter:any=[];
UserListWithoutFilterUser:any=[];


  ngOnInit(): void {
    this.refreshUsrList();
  }

  refreshUsrList(){
    this.service.getUsrList().subscribe(data=>{
      this.UserList=data;
      this.UserListWithoutFilter=data;
      this.UserListWithoutFilterUser=data;
       });
  }

  closeClick(){
    this.ActivateAddEditUsrComp=false;
    this.ActivateUrsHisComp=false;
    this.refreshUsrList();
    console.log()
  }

  addClick(){
    this.usr={
      UserId:0,
      UserSerie:"",
      UserName:"",
      UserPin:"",
      NameAndSerie:"",
      
    }
    this.ModalTitle="Adauga angajat";
    this.ActivateAddEditUsrComp=true;

  }

  FilterFn(){
    
    var UserNameFilter = this.UserNameFilter;

    this.UserList = this.UserListWithoutFilter.filter(function (el: { UserId: 
      { toString: () => string; }; UserName: { toString: () => string; }; }){
      return el.UserName.toString().toLowerCase().includes(
        UserNameFilter.toString().trim().toLowerCase()
      )
    });
  }

}
