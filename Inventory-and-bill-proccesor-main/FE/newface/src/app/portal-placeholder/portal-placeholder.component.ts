import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-portal-placeholder',
  templateUrl: './portal-placeholder.component.html',
  styleUrls: ['./portal-placeholder.component.css']
})
export class PortalPlaceholderComponent implements OnInit {
  title = '';
  description = '';
  icon = '◇';
  missingData = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.title = data['title'] || 'Modul nou';
      this.description = data['description'] || '';
      this.icon = data['icon'] || '◇';
      this.missingData = data['missingData'] || '';
    });
  }
}
