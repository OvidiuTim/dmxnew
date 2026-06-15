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

  administrator!: string;
  
  ngOnInit(): void {
    //aduce userul aici
    this.selectedUserSimple = this.service.selectedUser

    //refresh la lista
    this.refreshTolList();

    this.BucketDate = new Date();


    this.administrator=this.service.username 
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



    this.ToolList = this.ToolListWithoutFilter.filter((el: any) => {
      return this.matchesName(el, ToolNameFilter) && this.matchesLocation(el, ToolLocationFilter);
    });

    this.ToolListmain = this.ToolListWithoutFilter.filter((el: any) => {
      return this.matchesName(el, ToolNameFilter) && this.matchesLocation(el, ToolLocationFilterMagazie);
    });
  }


  refreshTolList(){
    this.ToolLocationFilter = ''+ this.selectedUserSimple.UserName


    var ToolLocationFilter = this.ToolLocationFilter;

    this.service.getTolList().subscribe(data=>{
      this.ToolList=data.filter((el: any) => this.matchesLocation(el, ToolLocationFilter));

      this.ToolLocationFilterMagazie = 'Magazie'
      var ToolLocationFilterMagazie = this.ToolLocationFilterMagazie;
      this.ToolListmain=data.filter((el: any) => this.matchesLocation(el, ToolLocationFilterMagazie));

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
      DateOfGiving:this.tol.DateReceived || this.tol.DateOfGiving || this.DateOfGiving ,
      Detail:this.Detail ,
      Pieces:this.Pieces ,
      MainLocation:this.MainLocation ,
      Location:this.MainLocation,
      Provider:this.Provider,
      AssignedUserId:this.selectedUserSimple?.UserId ?? null,
      IsSSM:!!this.tol.IsSSM,
      Status:'magazie',
      IsReturned:true,
      DateReturned:this.DateOfGiving,
      IsLost:false,
      DateLost:null
    
    };

    this.service.updateTool(val).subscribe(res=>{
    console.log(res.toString());
    });



    this.GiveRecive = "a preluat"
    this.Pieces=this.tol.Pieces;
    var valo = {
      user_serie:this.selectedUserSimple?.UserSerie,
      tool_serie:this.ToolSerie,
      direction:'IN',
      quantity:1,
      note:`Operat de ${this.administrator || 'administrator'}`
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
    this.User=this.selectedUserSimple.UserName;
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
      Location:this.MainLocation,
      Provider:this.Provider,
      AssignedUserId:this.selectedUserSimple?.UserId ?? null,
      IsSSM:!!this.tol.IsSSM,
      Status:'in_lucru',
      IsReturned:false,
      DateReturned:null,
      IsLost:false,
      DateLost:null
    
    };

    this.service.updateTool(val).subscribe(res=>{
   console.log(res.toString());
    });


    this.GiveRecive = "a predat"
    this.Pieces=this.tol.Pieces;
    var valo = {
      user_serie:this.selectedUserSimple?.UserSerie,
      tool_serie:this.ToolSerie,
      direction:'OUT',
      quantity:1,
      note:`Operat de ${this.administrator || 'administrator'}`
      };
      this.service.addHistory(valo).subscribe(res=>{
        console.log(res.toString());});
    
        
        this.wait()

  }

  private matchesName(tool: any, search: string): boolean {
    const name = String(tool?.ToolName ?? '').toLowerCase();
    return name.includes(String(search ?? '').trim().toLowerCase());
  }

  private matchesLocation(tool: any, search: string): boolean {
    const wanted = String(search ?? '').trim().toLowerCase();
    const location = String(tool?.Location ?? tool?.MainLocation ?? '').toLowerCase();
    const assignedName = String(tool?.AssignedUserName ?? '').toLowerCase();
    return location.includes(wanted) || assignedName.includes(wanted);
  }

}
