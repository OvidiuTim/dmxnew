import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  mode: 'default' | 'account' = 'account';
  password = '';
  pin = '';
  loading = false;
  error: string | null = null;

  constructor(private auth: AuthService, private router: Router) {}

  submit() {
    if (this.mode === 'account') {
      this.submitAccount();
      return;
    }
    if (this.loading || !this.password) return;
    this.loading = true; this.error = null;
    this.auth.login(this.password).subscribe({
      next: () => { this.loading = false; this.router.navigate(['/dashboard']); },
      error: (e) => { this.loading = false; this.error = 'Parolă invalidă'; console.error(e); }
    });
  }

  submitAccount(): void {
    if (this.loading || !this.pin.trim()) return;
    this.loading = true;
    this.error = null;
    this.auth.pinLogin(this.pin.trim()).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/team-dashboard');
      },
      error: (e) => { this.loading = false; this.error = e.status === 429 ? 'Prea multe încercări. Încearcă din nou mai târziu.' : 'PIN invalid sau cont inactiv'; console.error(e); }
    });
  }

  setMode(mode: 'default' | 'account'): void {
    this.mode = mode;
    this.error = null;
    this.password = '';
    this.pin = '';
  }

}
