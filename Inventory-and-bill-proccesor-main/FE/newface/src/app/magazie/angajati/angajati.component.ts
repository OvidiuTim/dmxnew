import { Component, OnInit, ViewChildren} from '@angular/core';
import { Router } from '@angular/router';
import {SharedService} from 'src/app/shared.service';
import { ViewChild, ElementRef, Renderer2, QueryList } from '@angular/core';
import { Result, BarcodeFormat } from '@zxing/library';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-angajati',
  templateUrl: './angajati.component.html',
  styleUrls: ['./angajati.component.css']
})


export class AngajatiComponent implements OnInit {


  constructor(private service:SharedService,private router: Router, private http: HttpClient,  private renderer: Renderer2) { }
    
  @ViewChild('myButton', { static: false }) myButton!: ElementRef;    
  @ViewChildren('userButton') userButtons!: QueryList<ElementRef>;

  simulateClick(index: number) {
    const buttonsArray = this.userButtons.toArray();
    if (index >= 0 && index < buttonsArray.length) {
      this.renderer.selectRootElement(buttonsArray[index].nativeElement).click();
    }
  }
  qrCodeFormat: BarcodeFormat = BarcodeFormat.QR_CODE;

  showScanner = false;
  scannedText = '';

  UserList:any=[];
  usr:any;

  usermodaltool:boolean=false;
  usermodalmaterial:boolean=false;
  usermodalschela:boolean=false;
  allowthischeck:boolean=false;


  searchValue: string = '';
  //variabile angajati
  UserId!: string;
  UserName!: string;
  UserSerie!: string;
  NameAndSerie!: string;
  chipselectat!: string;


  loginname!: string;
  ngOnInit(): void {
    this.refreshUsrList();

    this.allowthischeck = this.service.allowthis

    this.loginname=this.service.username
  }



  closemodals(){
    this.usermodaltool=false;
    this.usermodalmaterial=false;
    this.usermodalschela=false;
    this.searchValue = '';

  }
  refreshUsrList(){
    this.service.getUsrList().subscribe(data=>{
      this.UserList=data;

    });
  }
  

  modalTitluUsername!: string;

  modalunelte(item: any) {
    this.usermodaltool = false;
    this.service.selectedUser = item;
    console.log(this.usermodaltool);
    this.modalTitluUsername = item.UserName;
    setTimeout(() => {
      this.usermodaltool = true;
    }, 0);
  }
  

  modalmaterial(item: any){
    this.usermodalmaterial=true
    this.service.selectedUser=item;
  }

  modalshecla(item: any){
    this.usermodalschela=true
    this.service.selectedUser=item;
  }

  addClick(){
    this.usr={
      UserId:0,
      UserSerie:"",
      UserName:"",
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
    this.service.deleteUser(item.UserId).subscribe({
      next: (data) => {
        console.log(data?.toString?.() ?? data);
        this.refreshUsrList();
        this.wait();
      },
      error: (err) => {
        console.error('Eroare la stergerea angajatului', err);
        const message =
          err?.error?.message ||
          err?.error?.error ||
          'Angajatul nu a putut fi sters. Daca are pontaj, istoric, plati sau concedii, trebuie arhivat sau curatat manual.';

        if (err?.status === 409) {
          const forceDelete = confirm(`${message}\n\nVrei sa-l stergi oricum? Aceasta actiune va sterge pontajul, platile si concediile lui si va scoate legaturile din istoric.`);
          if (forceDelete) {
            this.service.deleteUser(item.UserId, true).subscribe({
              next: (forcedData) => {
                console.log(forcedData?.toString?.() ?? forcedData);
                this.refreshUsrList();
                this.wait();
              },
              error: (forceErr) => {
                console.error('Eroare la stergerea fortata a angajatului', forceErr);
                alert(
                  forceErr?.error?.message ||
                  forceErr?.error?.error ||
                  'Angajatul nu a putut fi sters nici cu override.'
                );
              }
            });
            return;
          }
        }

        alert(message);
      }
    })
    }
}



search() {
  console.log('Search function called with value:', this.searchValue);

  if (this.searchValue === '') {
    return;
  }

  let matchingUser;
  let userIndex = -1;
  const normalizedSearch = this.searchValue.trim().toLowerCase();

  for (const [index, user] of this.UserList.entries()) {
    console.log('userul verificat este ', user.UserName);

    if (
      String(user.UserSerie ?? '').trim().toLowerCase() === normalizedSearch ||
      String(user.uid ?? '').trim().toLowerCase() === normalizedSearch
    ) {
      matchingUser = user;
      userIndex = index;
      break;
    }
  }

  if (matchingUser && userIndex >= 0) {
    this.modalunelte(matchingUser);
    this.simulateClick(userIndex);
    this.showScanner = !this.showScanner;

  }
}




//qrscanner
toggleScanner() {
  this.showScanner = !this.showScanner;
}
onScanSuccess(result: string): void {
  this.searchValue = result;
  this.search();
}

isMenuOpen = false;

toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
}



}
