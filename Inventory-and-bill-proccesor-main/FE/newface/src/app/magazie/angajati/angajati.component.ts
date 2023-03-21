import { Component, OnInit} from '@angular/core';
import { Router } from '@angular/router';
import {SharedService} from 'src/app/shared.service';
import * as pcsc from 'nfc-pcsc';// tslint:disable-line



const reader = new pcsc.Reader();

// ...rest of your code...

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
  usermodalschela:boolean=false;
  allowthischeck:boolean=false;

  //variabile angajati
  UserId!: string;
  UserName!: string;
  UserSerie!: string;
  UserPin!: string;
  NameAndSerie!: string;

  
  
  ngOnInit(): void {
    this.refreshUsrList();

    this.allowthischeck = this.service.allowthis


    if ('NDEFReader' in window) {
      console.log('Web NFC is supported.');
    } else {
      console.log('Web NFC is not supported.');
    }

  }


  closemodals(){
    this.usermodaltool=false;
    this.usermodalmaterial=false;
    this.usermodalschela=false;
    
  }
  refreshUsrList(){
    this.service.getUsrList().subscribe(data=>{
      this.UserList=data;

    });
  }
  


  modalunelte(item: any){
    this.usermodaltool=true
    this.service.selectedUser=item;
    this.service.selectedUserPin=item.UserPin;
    
  }

  modalmaterial(item: any){
    this.usermodalmaterial=true
    this.service.selectedUser=item;
    this.service.selectedUserPin=item.UserPin;
  }

  modalshecla(item: any){
    this.usermodalschela=true
    this.service.selectedUser=item;
    this.service.selectedUserPin=item.UserPin;
  }

  addClick(){
    this.usr={
      UserId:0,
      UserSerie:"",
      UserName:"",
      UserPin:"",
      NameAndSerie:"",
      
    }

    this.refreshUsrList();
  }


  wait(){

    setTimeout(() => {
      this.refreshUsrList()
      this.enough()
    }, 200);
}


enough(){
  this.refreshUsrList()
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


  addUser(){

    var val = {UserId:this.UserId,
              UserSerie:"1",
              UserPin:"1",
              UserName:this.UserName,
              NameAndSerie:"1",};
    this.service.addUser(val).subscribe(res=>{
      console.log(res.toString());
      
    });

    this.refreshUsrList();
    this.wait()
  }



  deleteClick(item: { UserId: any; }){
    if(confirm('Esti sigur?')){
    this.service.deleteUser(item.UserId).subscribe(data=>{
      console.log(data.toString());
      this.refreshUsrList();
      this.wait()
    })
    }
}



}
