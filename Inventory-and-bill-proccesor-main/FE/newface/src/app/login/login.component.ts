import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  constructor(private router: Router, private service:SharedService) { }
  
  username!: string;
  password!: string;


  ngOnInit(): void {
    


  }
      
  seeMagazie(){
   

    if(
       this.password == "GrozaVasile" && this.username == "GrozaVasile" 
    || this.password == "magazieSILVIU" && this.username == "Silviu"
    || this.password == "MunteanuDan" && this.username == "MunteanuDan"
    || this.password == "StelaAdministrare" && this.username == "Stela"
    || this.password == "SERBANDANIEL" && this.username == "SerbanDaniel"){

      this.router.navigateByUrl('/angajati');
      this.service.admin= false;
      this.service.allowthis= true;
      this.service.username = this.username
    }
    else {
      false;
    }

  }



}
