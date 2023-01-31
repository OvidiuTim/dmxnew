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
   

    if(this.password == "magazie" && this.username == "magazie"){
      this.router.navigateByUrl('/magazie');
      this.service.admin= false;
      this.service.allowthis= true;
    }
    else if(this.password == "admin" && this.username == "admin"){
      this.router.navigateByUrl('/magazie');
      this.service.admin= true;
      this.service.allowthis= true;
    }

  }



}
