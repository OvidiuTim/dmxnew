import { Component, OnInit } from '@angular/core';
import {SharedService} from 'src/app/shared.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-modal-unelte',
  templateUrl: './modal-unelte.component.html',
  styleUrls: ['./modal-unelte.component.css']
})
export class ModalUnelteComponent implements OnInit {

  constructor(private router: Router, private service:SharedService) { }
  

  ngOnInit(): void {

  }

}
