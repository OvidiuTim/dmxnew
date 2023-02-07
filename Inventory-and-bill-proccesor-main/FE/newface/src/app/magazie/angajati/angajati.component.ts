import { Component, OnInit} from '@angular/core';
import { Router } from '@angular/router';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-angajati',
  templateUrl: './angajati.component.html',
  styleUrls: ['./angajati.component.css']
})
export class AngajatiComponent implements OnInit {

  constructor(private service:SharedService,private router: Router) { }
    
  UserList:any=[];
  usr:any;

  usermodaltool:boolean=false;
  usermodalmaterial:boolean=false;
  allowthischeck:boolean=false;

  ngOnInit(): void {
    this.refreshUsrList();

    this.allowthischeck = this.service.allowthis

  }


  closemodals(){
    this.usermodaltool=false;
    this.usermodalmaterial=false;
  }
  refreshUsrList(){
    this.service.getUsrList().subscribe(data=>{
      this.UserList=data;
       });

  }


  modalunelte(item: any){
    this.usermodaltool=true
    this.service.selectedUser=item;

  }

  modalmaterial(item: any){
    this.usermodalmaterial=true
    this.service.selectedUser=item;

  }


  addClick(){
    this.usr={
      UserId:0,
      UserSerie:"",
      UserName:"",
      UserPin:"",
      NameAndSerie:"",
      
    }


  }




  seeMagazie(){
    this.router.navigateByUrl('/magazie')
  }
  seeAngajati(){
    this.router.navigateByUrl('/angajati')
  }
  seeMateriale(){
    this.router.navigateByUrl('/materiale')
  }
  seeUnelte(){
    this.router.navigateByUrl('/unelte')
  }
  seeSchela(){
    this.router.navigateByUrl('/schela')
  }
  seeIstoric(){
    this.router.navigateByUrl('/history')
  }


}
