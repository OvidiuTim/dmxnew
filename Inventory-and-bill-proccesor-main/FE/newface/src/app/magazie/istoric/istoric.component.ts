import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {SharedService} from 'src/app/shared.service';


@Component({
  selector: 'app-istoric',
  templateUrl: './istoric.component.html',
  styleUrls: ['./istoric.component.css']
})
export class IstoricComponent implements OnInit {

  constructor(private service:SharedService,private router: Router) { }
    
  UserList:any=[];
  usr:any;

  usermodaltool:boolean=false;
  allowthischeck:boolean=false;

  isMat:boolean=true;
  isUne:boolean=false;
  isSch:boolean=false;
  

  ngOnInit(): void {
    this.refreshUsrList();

    this.allowthischeck = this.service.allowthis
  }

/*---------- sidebar links ----------*/
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
    this.router.navigateByUrl('/istoric')
  }

  closemodals(){
    this.usermodaltool=false;

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
  addClick(){
    this.usr={
      UserId:0,
      UserSerie:"",
      UserName:"",
      UserPin:"",
      NameAndSerie:"",
      
    }
  }


/*---------- istoric buttons ----------*/

istMaterial(){
  this.isMat=true;
  this.isUne=false;
  this.isSch=false;
}
istUnelte(){
  this.isMat=false;
  this.isUne=true;
  this.isSch=false;
}
istSchela(){
  this.isMat=false;
  this.isUne=false;
  this.isSch=true;
}


}
