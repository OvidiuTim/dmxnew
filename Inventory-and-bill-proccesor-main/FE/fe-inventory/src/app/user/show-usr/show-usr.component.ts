import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-show-usr',
  templateUrl: './show-usr.component.html',
  styleUrls: ['./show-usr.component.css']
})
export class ShowUsrComponent implements OnInit {

  constructor(private service:SharedService) { }

  UserList:any=[];
  
  

  ModalTitle:string | undefined;
  ActivateAddEditUsrComp:boolean=false;
  ActivateUrsHisComp:boolean=false;
  usr:any;
  use:any;
  


  ngOnInit(): void {
    this.refreshUsrList();
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

  historyClick(){
    this.ModalTitle="Istoric";
    this.ActivateUrsHisComp=true;
  }


  deleteClick(item: { UserId: any; }){
    if(confirm('Are you sure??')){
      this.service.deleteUser(item.UserId).subscribe(data=>{
        alert(data.toString());
        this.refreshUsrList();
      })
    }
  }

  closeClick(){
    this.ActivateAddEditUsrComp=false;
    this.ActivateUrsHisComp=false;
    this.refreshUsrList();
    console.log()
  }



  refreshUsrList(){
    this.service.getUsrList().subscribe(data=>{
      this.UserList=data;
       });
  }

}

  

