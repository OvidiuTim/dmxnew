import { Component, OnInit } from '@angular/core';
import { SharedService } from 'src/app/shared.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  histToolList: any[] = [];

  constructor(private service: SharedService) {}

  ngOnInit(): void {
    this.refreshHisList();
  }

  refreshHisList() {
    this.service.getHisList().subscribe(data => {
      this.histToolList = data;
    });
  }
}
