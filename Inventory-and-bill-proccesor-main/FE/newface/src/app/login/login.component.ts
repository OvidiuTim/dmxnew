import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  mode: 'default' | 'account' = 'default';
  password = '';
  username = '';
  pin = '';
  loading = false;
  error: string | null = null;

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    if (this.mode === 'account') {
      this.submitAccount();
      return;
    }
    if (!this.password) return;
    this.loading = true; this.error = null;
    this.auth.login(this.password).subscribe({
      next: () => { this.loading = false; this.router.navigate(['/pontaj']); },
      error: (e) => { this.loading = false; this.error = 'Parolă invalidă'; console.error(e); }
    });
  }

  submitAccount(): void {
    if (!this.username || !this.pin) return;
    this.loading = true;
    this.error = null;
    this.auth.appLogin(this.username, this.pin).subscribe({
      next: () => { this.loading = false; this.router.navigate(['/pontaj']); },
      error: (e) => { this.loading = false; this.error = 'Username sau PIN invalid'; console.error(e); }
    });
  }

  useAccountLogin(): void {
    this.mode = 'account';
    this.error = null;
  }

  useDefaultLogin(): void {
    this.mode = 'default';
    this.error = null;
  }
}
