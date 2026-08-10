import { Component, Input, OnChanges } from '@angular/core';
import { TeamEmployee } from './team-api.service';

@Component({
  selector: 'app-employee-avatar',
  templateUrl: './employee-avatar.component.html',
  styleUrls: ['./employee-avatar.component.css']
})
export class EmployeeAvatarComponent implements OnChanges {
  @Input() employee?: TeamEmployee;
  @Input() size: 'normal' | 'small' = 'normal';
  imageFailed = false;

  ngOnChanges(): void {
    this.imageFailed = false;
  }

  get photo(): string {
    return String(this.employee?.photo || '').trim();
  }

  get initial(): string {
    return String(this.employee?.name || '?').trim().charAt(0).toLocaleUpperCase('ro-RO') || '?';
  }

  onImageError(): void {
    this.imageFailed = true;
  }
}
