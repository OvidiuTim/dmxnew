import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-no-access',
  templateUrl: './no-access.component.html',
  styleUrls: ['./no-access.component.css']
})
export class NoAccessComponent {
  readonly noModules: boolean;

  constructor(private router: Router, route: ActivatedRoute) {
    this.noModules = route.snapshot.queryParamMap.get('reason') === 'no-modules';
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
