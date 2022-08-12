import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-add-edit-usr',
  templateUrl: './add-edit-usr.component.html',
  styleUrls: ['./add-edit-usr.component.css']
})
export class AddEditUsrComponent implements OnInit {

  constructor(private service:SharedService) { }

  @Input() usr:any;
  UserId!: string;
  UserName!: string;
  UserSerie!: string;
  UserPin!: string;
  NameAndSerie!: string;



ngOnInit(): void {
  this.UserId=this.usr.UserId;
  this.UserSerie=this.usr.UserSerie;
  this.UserName=this.usr.UserName;
  this.UserPin=this.usr.UserPin;
  this.NameAndSerie=this.usr.NameAndSerie;
}

addNameSerie(){
  this.NameAndSerie =this.UserName + this.UserSerie
}

addUser(){
  this.addNameSerie()
  var val = {UserId:this.UserId,
            UserSerie:this.UserSerie,
            UserPin:this.UserPin,
            UserName:this.UserName,
            NameAndSerie:this.NameAndSerie,};
  this.service.addUser(val).subscribe(res=>{
    alert(res.toString());
    
  });
}


}
