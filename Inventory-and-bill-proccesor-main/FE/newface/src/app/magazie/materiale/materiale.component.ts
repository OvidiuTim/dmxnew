import { Component, OnInit} from '@angular/core';
import { Router } from '@angular/router';
import {SharedService} from 'src/app/shared.service';



@Component({
  selector: 'app-materiale',
  templateUrl: './materiale.component.html',
  styleUrls: ['./materiale.component.css']
})
export class MaterialeComponent implements OnInit {

  constructor(private service:SharedService,private router: Router) { }


  ngOnInit(): void {
    
    //aduce userul aici
  }

  ToolList:any=[];
  ToolListmain:any=[];
  ToolListWithoutFilter:any=[];
  
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

  refreshMatList(){


    this.service.getMatList().subscribe(data=>{
      this.ToolList=data;
      this.ToolListWithoutFilter=data;
    });
  }
}
