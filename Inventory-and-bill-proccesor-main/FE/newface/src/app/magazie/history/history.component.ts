import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {SharedService} from 'src/app/shared.service';
import { ngxCsv } from 'ngx-csv/ngx-csv';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {

  constructor(private service:SharedService,private router: Router) { }
    
  UserList:any=[];
  usr:any;

  usermodaltool:boolean=false;
  allowthischeck:boolean=false;

  isMat:boolean=true;
  isUne:boolean=false;
  isSch:boolean=false;
  

  ngOnInit(): void {
    this.istMaterial();

    this.refreshUsrList();
    this.refreshHisList();

    this.allowthischeck = this.service.allowthis

    console.log("aici")
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
    this.router.navigateByUrl('/history')
  }

  closemodals(){
    this.usermodaltool=false;

  }
  refreshUsrList(){


    this.refreshConsumList()

  }
  modalunelte(item: any){


    this.usermodaltool=true
    this.service.selectedUser=item;

  }


/*---------- istoric buttons ----------*/
checkmyscafoldingid(){
  for(let i=8; i<=10; i++){
    document.getElementById(''+ i)!.style.backgroundColor = '#efefef';
    document.getElementById(''+ i)!.style.fontWeight = 'normal';
  }
}
istMaterial(){
  this.isMat=true;
  this.isUne=false;
  this.isSch=false;

  this.checkmyscafoldingid();
  document.getElementById("8")!.style.backgroundColor = '#d9d9d9';
  document.getElementById("8")!.style.fontWeight = 'bold';
}
istUnelte(){
  this.isMat=false;
  this.isUne=true;
  this.isSch=false;

  this.checkmyscafoldingid();
  document.getElementById("9")!.style.backgroundColor = '#d9d9d9';
  document.getElementById("9")!.style.fontWeight = 'bold';
}
istSchela(){
  this.isMat=false;
  this.isUne=false;
  this.isSch=true;

  this.checkmyscafoldingid();
  document.getElementById("10")!.style.backgroundColor = '#d9d9d9';
  document.getElementById("10")!.style.fontWeight = 'bold';
}

histList:any=[];

refreshConsumList(){
  this.service.getConList().subscribe(data=>{
    this.histList=data;
  });
}


histToolList:any=[];

refreshHisList(){
  this.service.getHisList().subscribe(data=>{
    this.histToolList=data;
  });
}



downloadhistory(){

  var options = { 
    fieldSeparator: ',',
    quoteStrings: '"',
    decimalseparator: '.',
    showLabels: true, 
    showTitle: true,
    title: 'Report Materiale',
    useBom: true,
    headers: [" MaterialId", "MaterialName", "Quantity", "Amount" , "MaterialLocation", "OneUnity", "UnityOfMesurment", "TypeOfUnityOfMesurment"]
  };
 
  new ngxCsv(this.histToolList, "materiale", options);
}


}
