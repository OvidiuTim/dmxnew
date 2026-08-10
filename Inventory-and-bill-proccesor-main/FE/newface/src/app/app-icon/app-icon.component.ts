import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon',
  templateUrl: './app-icon.component.html',
  styleUrls: ['./app-icon.component.css']
})
export class AppIconComponent {
  @Input() name = 'circle';
  @Input() size = 20;
}
