import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-selected-user',
  templateUrl: './selected-user.component.html',
  styleUrls: ['./selected-user.component.css']
})
export class SelectedUserComponent implements OnInit {

  constructor(private service:SharedService) { }
  @Input() usr:any;
  ShedList:any=[];
  ngOnInit(): void {
  }

}
