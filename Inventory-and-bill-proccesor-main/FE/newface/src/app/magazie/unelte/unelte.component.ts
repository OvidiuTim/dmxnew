import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-unelte',
  templateUrl: './unelte.component.html',
  styleUrls: ['./unelte.component.css']
})
export class UnelteComponent implements OnInit {

  constructor(private router: Router, private service:SharedService, private datePipe: DatePipe) { }
  
  NuAcelas:boolean=true;
  DaAcelas:boolean=false;


  startingPoint:string="";

  ngOnInit(): void {
    this.startingPoint = '1';

    this.refreshMatList()
    this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
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


  
  Nuacelas(){
    this.NuAcelas=true;
    this.DaAcelas=false;
  
    document.getElementById("1")!.style.backgroundColor = '#d9d9d9';
  }
  Daacelas(){
    this.NuAcelas=false;
    this.DaAcelas=true;
  
    document.getElementById("2")!.style.backgroundColor = '#d9d9d9';
  }

  ToolList:any=[];
  ToolListmain:any=[];
  ToolListWithoutFilter:any=[];

  refreshMatList(){
    this.service.getTolList().subscribe(data=>{
      this.ToolList=data;

    });
  }

  deleteClick(item:{ ToolId: any;}){
    this.service.deleteTool(item.ToolId).subscribe(data=>{
      console.log(data.toString());
      this.refreshMatList();
    })
  }

  ToolId!: string;
  ToolSerie!: string;
  MaterialId!: string;
  ToolName!: string;
  Pieces!: string;
  DateOfGiving!:any;
  BucketDate!: Date;

  addUser(){


    var val = {ToolId:this.ToolId,
              ToolSerie:this.ToolSerie,
              ToolName:this.ToolName,
              User:"Magazie",
              DateOfGiving:"1111-11-11",
              Detail:"1",
              Pieces:this.Pieces,
              MainLocation:"Magazie",   
              Provider:'1',};
    this.service.addTool(val).subscribe(res=>{
      console.log (res.toString());

    });
  }



  
}
