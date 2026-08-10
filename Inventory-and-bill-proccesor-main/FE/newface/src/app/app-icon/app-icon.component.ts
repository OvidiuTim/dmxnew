import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon',
  templateUrl: './app-icon.component.html',
  styleUrls: ['./app-icon.component.css']
})
export class AppIconComponent {
  @Input() name = 'circle';
  @Input() size = 20;

  private readonly glyphs: Record<string, string> = {
    dashboard: 'dashboard',
    clock: 'schedule',
    chart: 'bar_chart',
    badge: 'badge',
    team: 'groups',
    calendar: 'calendar_month',
    warehouse: 'warehouse',
    tool: 'construction',
    shield: 'health_and_safety',
    history: 'history',
    document: 'description',
    logout: 'logout',
    search: 'search',
    package: 'inventory_2',
    'user-check': 'engineering',
    alert: 'warning',
    'arrow-up': 'call_made',
    'arrow-down': 'call_received',
    adjust: 'tune',
    list: 'visibility',
    circle: 'circle'
  };

  get glyph(): string {
    return this.glyphs[this.name] || this.name;
  }
}
