import { Component, OnInit} from '@angular/core';
import { Router } from '@angular/router';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-administrator',
  templateUrl: './administrator.component.html',
  styleUrls: ['./administrator.component.css']
})
export class AdministratorComponent implements OnInit {

  constructor(private service:SharedService,private router: Router) { }

  ngOnInit(): void {
    this.router.navigateByUrl('/angajati')
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
}
