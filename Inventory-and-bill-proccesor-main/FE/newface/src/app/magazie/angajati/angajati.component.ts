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

  allowthischeck:boolean=false;

  ngOnInit(): void {
    this.refreshUsrList();

    this.allowthischeck = this.service.allowthis
    console.log(this.service.admin)
    console.log(this.service.allowthis)
  }

  refreshUsrList(){
    this.service.getUsrList().subscribe(data=>{
      this.UserList=data;
       });
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


}
