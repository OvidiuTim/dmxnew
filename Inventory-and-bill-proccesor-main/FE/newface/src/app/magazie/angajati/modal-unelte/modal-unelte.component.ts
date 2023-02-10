import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { Router } from '@angular/router';
import { interval } from 'rxjs';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-modal-unelte',
  templateUrl: './modal-unelte.component.html',
  styleUrls: ['./modal-unelte.component.css']
})
export class ModalUnelteComponent implements OnInit {

  constructor(private router: Router, private service:SharedService, private datePipe: DatePipe) { }
  
  ToolList:any=[];
  ToolListmain:any=[];
  ToolListWithoutFilter:any=[];

  tol:any=[];

  ToolLocationFilter:string="";
  ToolLocationFilterMagazie:string="";
  ToolNameFilter:string="";
  selectedUserSimple : any
  une:any;

  timmer:boolean=false;

  //edit location tool pieces

  ToolId!: string;
  ToolSerie!: string;
  Pieces!: Number;
  ToolName!: string;
  User!: string;
  DateOfGiving!:any;
  BucketDate!: Date;
  Provider!: string;
  Detail!: string;
  MainLocation!: string;
 
  // date historic
  HistoryId!: string;
  GiveRecive!: string;

  
  ngOnInit(): void {
    //aduce userul aici
    this.selectedUserSimple = this.service.selectedUser

    //refresh la lista
    this.refreshTolList();

    this.BucketDate = new Date();


  }

  wait(){
    this.timmer=true;
    setTimeout(() => {
      this.refreshTolList()
      this.enough()
    }, 200);
}


  enough(){
    this.timmer=false;
    this.refreshTolList()
  }
  FilterFn(){
    
    var ToolNameFilter = this.ToolNameFilter;
    this.ToolLocationFilter = ''+ this.selectedUserSimple.UserName
    var ToolLocationFilter = this.ToolLocationFilter;

    this.ToolLocationFilterMagazie = 'Magazie'
    var ToolLocationFilterMagazie = this.ToolLocationFilterMagazie;



    this.ToolList = this.ToolListWithoutFilter.filter(function (el: { ToolId: 
      { toString: () => string; }; ToolName: { toString: () => string; };
      MainLocation: { toString: () => string; };
    
    }){


        return el.ToolName.toString().toLowerCase().includes(
        ToolNameFilter.toString().trim().toLowerCase()
      )
      && el.MainLocation.toString().toLowerCase().includes(
        ToolLocationFilter.toString().trim().toLowerCase())
    });



    this.ToolListmain = this.ToolListWithoutFilter.filter(function (el: { ToolId: 
      { toString: () => string; }; ToolName: { toString: () => string; }; 
      MainLocation: { toString: () => string; }; 
    
    
    }){
      
        return el.ToolName.toString().toLowerCase().includes(
        ToolNameFilter.toString().trim().toLowerCase()
      )&&el.MainLocation.toString().toLowerCase().includes(
        ToolLocationFilterMagazie.toString().trim().toLowerCase()
      ) 

    });
  }


  refreshTolList(){
    this.ToolLocationFilter = ''+ this.selectedUserSimple.UserName


    var ToolLocationFilter = this.ToolLocationFilter;

    this.service.getTolList().subscribe(data=>{
      this.ToolList=data.filter(function (el: {MainLocation: 
        { toString: () => string; }; }) { 
          return el.MainLocation.toString().toLowerCase().includes(
            ToolLocationFilter.toString().trim().toLowerCase()
          ) 
        });

      this.ToolLocationFilterMagazie = 'Magazie'
      var ToolLocationFilterMagazie = this.ToolLocationFilterMagazie;
      this.ToolListmain=data.filter(function (el: {MainLocation: 
        { toString: () => string; }; }) { 
          return el.MainLocation.toString().toLowerCase().includes(
            ToolLocationFilterMagazie.toString().trim().toLowerCase()
          ) 
        });

        this.ToolListWithoutFilter=data;
    });
  
  }

  // aici preluare unealta/ edit tool main location

  preluareUnealta(item: any){

    this.tol=item;

    this.ToolId=this.tol.ToolId;
    this.ToolSerie=this.tol.ToolSerie;
    this.ToolName=this.tol.ToolName;
    this.User=this.tol.User;
    this.DateOfGiving = (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    this.Detail=this.tol.Detail;
    this.Pieces=this.tol.Pieces;
    this.MainLocation='Magazie'
    this.Provider=this.tol.Provider

       
    var val = {
      ToolId:this.ToolId,
      ToolSerie:this.ToolSerie,
      ToolName:this.ToolName,
      User:this.User,
      DateOfGiving:this.DateOfGiving ,
      Detail:this.Detail ,
      Pieces:this.Pieces ,
      MainLocation:this.MainLocation ,
      Provider:this.Provider 
    
    };

    this.service.updateTool(val).subscribe(res=>{
    console.log(res.toString());
    });



    this.GiveRecive = "a preluat"
    this.Pieces=this.tol.Pieces;
    var valo = {HistoryId:this.HistoryId,
      Tool:this.ToolName,
      User:this.User,
      DateOfGiving:this.DateOfGiving,
      ToolSerie:this.ToolSerie,
      GiveRecive:this.GiveRecive,
      Pieces:this.Pieces
      };
      this.service.addHistory(valo).subscribe(res=>{
        console.log(res.toString());});
        
        
        this.ToolNameFilter=''
        this.wait()
        console.log(this.DateOfGiving)
  }
  // aici predare unealta/ edit tool main location
  predareUnealta(item: any){
    this.ToolNameFilter=''

    this.tol=item;

    this.ToolId=this.tol.ToolId;
    this.ToolSerie=this.tol.ToolSerie;
    this.ToolName=this.tol.ToolName;
    this.User=this.tol.User;
    this.DateOfGiving= (this.datePipe.transform(this.BucketDate,"yyyy-MM-dd"));
    this.Detail=this.tol.Detail;
    this.Pieces=this.tol.Pieces;
    this.MainLocation=''+ this.selectedUserSimple.UserName
    this.Provider=this.tol.Provider


    this.refreshTolList()
    var val = {
      ToolId:this.ToolId,
      ToolSerie:this.ToolSerie,
      ToolName:this.ToolName,
      User:this.User,
      DateOfGiving:this.DateOfGiving ,
      Detail:this.Detail ,
      Pieces:this.Pieces ,
      MainLocation:this.MainLocation ,
      Provider:this.Provider 
    
    };

    this.service.updateTool(val).subscribe(res=>{
   console.log(res.toString());
    });


    this.GiveRecive = "a predat"
    this.Pieces=this.tol.Pieces;
    var valo = {HistoryId:this.HistoryId,
      Tool:this.ToolName,
      User:this.User,
      DateOfGiving:this.DateOfGiving,
      ToolSerie:this.ToolSerie,
      GiveRecive:this.GiveRecive,
      Pieces:this.Pieces
      };
      this.service.addHistory(valo).subscribe(res=>{
        console.log(res.toString());});
    
        
        this.wait()

  }





}
