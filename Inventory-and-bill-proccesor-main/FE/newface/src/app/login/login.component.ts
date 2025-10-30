import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  password = '';
  loading = false;
  error: string | null = null;

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    if (!this.password) return;
    this.loading = true; this.error = null;
    this.auth.login(this.password).subscribe({
      next: () => { this.loading = false; this.router.navigate(['/pontaj']); },
      error: (e) => { this.loading = false; this.error = 'Parolă invalidă'; console.error(e); }
    });
  }
}
