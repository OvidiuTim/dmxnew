import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';

@Component({
  selector: 'app-show-service',
  templateUrl: './show-service.component.html',
  styleUrls: ['./show-service.component.css']
})
export class ShowServiceComponent implements OnInit {

  constructor(private service:SharedService) { }
  @Input() tol:any;


  Service!: string;




  ngOnInit(): void {

    this.Service=this.tol.Service

  }
}
