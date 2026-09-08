import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let auth: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    auth = jasmine.createSpyObj('AuthService', ['pinLogin', 'login']);
    auth.pinLogin.and.returnValue(of({ ok: true, role: 'app_user', auth_type: 'app_user' }));
    auth.login.and.returnValue(of({ ok: true, role: 'admin', auth_type: 'legacy' }));
    router = jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']);
    await TestBed.configureTestingModule({
      declarations: [LoginComponent], imports: [FormsModule],
      providers: [{ provide: AuthService, useValue: auth }, { provide: Router, useValue: router }],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows only employee PIN by default and routes to Team Management', () => {
    expect(fixture.nativeElement.querySelector('input[name="username"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="pin"]')).not.toBeNull();
    component.pin = ' 0123 ';
    component.submit();
    expect(auth.pinLogin).toHaveBeenCalledOnceWith('0123');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/team-dashboard');
  });

  it('keeps the general password for administrator login', () => {
    component.setMode('default');
    component.password = 'admin-secret';
    component.submit();
    expect(auth.login).toHaveBeenCalledOnceWith('admin-secret');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(auth.pinLogin).not.toHaveBeenCalled();
  });

  it('does not submit blank PINs or duplicate an in-flight login', () => {
    component.pin = ' ';
    component.submit();
    component.pin = '0123';
    component.loading = true;
    component.submit();
    expect(auth.pinLogin).not.toHaveBeenCalled();
  });

  it('shows rate limiting and stays on login for rejected PINs', () => {
    spyOn(console, 'error');
    auth.pinLogin.and.returnValue(throwError(() => ({ status: 429 })));
    component.pin = '0123';
    component.submit();
    expect(component.error).toContain('Prea multe încercări');
    expect(component.loading).toBeFalse();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
