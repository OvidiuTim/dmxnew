import { Component, OnInit, Input } from '@angular/core';
import {SharedService} from 'src/app/shared.service';


@Component({
  selector: 'app-show-provider',
  templateUrl: './show-provider.component.html',
  styleUrls: ['./show-provider.component.css']
})
export class ShowProviderComponent implements OnInit {

  constructor(private service:SharedService) { }
  @Input() mat:any;

  Provider!: string;

  ngOnInit(): void {

    this.Provider=this.mat.Provider
  
  }

}

