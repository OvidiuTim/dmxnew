import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-add-edit-his',
  templateUrl: './add-edit-his.component.html',
  styleUrls: ['./add-edit-his.component.css']
})
export class AddEditHisComponent implements OnInit {

  constructor() { }

  @Input() his:any;
  ngOnInit(): void {
  }

}
