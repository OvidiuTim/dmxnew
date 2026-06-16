import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

import { MagazieComponent } from './magazie/magazie.component';
import { AngajatiComponent } from './magazie/angajati/angajati.component';
import { MaterialeComponent } from './magazie/materiale/materiale.component';
import { SchelaComponent } from './magazie/schela/schela.component';
import { UnelteComponent } from './magazie/unelte/unelte.component';
import { AdaugaUnealtaComponent } from './magazie/unelte/adauga-unealta/adauga-unealta.component';
import { PredareUnealtaComponent } from './magazie/unelte/predare-unealta/predare-unealta.component';
import { LoginComponent } from './login/login.component';
import { HistoryComponent } from './magazie/history/history.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ShelfsComponent } from './shelfs/shelfs.component';
import { PontajComponent } from './pontaj/pontaj.component';
import { UserpontatComponent } from './pontaj/userpontat/userpontat.component';
import { RapoarteComponent } from './pontaj/rapoarte/rapoarte.component';
import { EmployeeFormComponent } from './pontaj/employee-form/employee-form.component';
import { FisaAngajatComponent } from './pontaj/fisa-angajat/fisa-angajat.component';
import { ClockinandoutComponent } from './clockinandout/clockinandout.component';
import { ClockinandoutdriverComponent } from './clockinandoutdriver/clockinandoutdriver.component';
import { AdminAppPageComponent } from './admin-app-page/admin-app-page.component';
import { NoAccessComponent } from './no-access/no-access.component';

import { AuthGuard } from './auth/auth.guard';

const routes: Routes = [
  // Login deschis
  { path: 'login', component: LoginComponent },
  { path: 'no-access', component: NoAccessComponent },
  { path: 'admin-app-page', component: AdminAppPageComponent },

  // Pontaj protejat (acoperă /pontaj/ - ruta goală)
  { path: '', component: PontajComponent, pathMatch: 'full', canActivate: [AuthGuard], data: { permissionRoute: '/pontaj' } },

  // Pontaj protejat (fallback dacă ai linkuri către /pontaj/pontaj)
  { path: 'pontaj', component: PontajComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj' } },

  // Pontaj manual separat
  { path: 'clockinandout', component: ClockinandoutComponent },
  { path: 'clockinandoutdriver', component: ClockinandoutdriverComponent },

  // Pontaj protejat (fallback dacă ai linkuri către /pontaj/pontaj)
  { path: 'pontaj/rapoarte', component: RapoarteComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/rapoarte' } },
  { path: 'pontaj/fisa-angajat', component: FisaAngajatComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/fisa-angajat' } },
  { path: 'pontaj/fisa-angajat/:id', component: FisaAngajatComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/fisa-angajat' } },

  // Formular angajat
  { path: 'users/new', component: EmployeeFormComponent, canActivate: [AuthGuard], data: { permissionRoute: '/users/new' } },
  { path: 'users/:id/edit', component: EmployeeFormComponent, canActivate: [AuthGuard], data: { permissionRoute: '/user/:id' } },

  // Pagina utilizator protejată (/pontaj/user/:id)
  { path: 'user/:id', component: UserpontatComponent, canActivate: [AuthGuard], data: { permissionRoute: '/user/:id' } },

  { path: 'magazie', component: MagazieComponent, canActivate: [AuthGuard], data: { permissionRoute: '/magazie' } },
  { path: 'angajati', component: AngajatiComponent, canActivate: [AuthGuard], data: { permissionRoute: '/angajati' } },
  { path: 'materiale', component: MaterialeComponent, canActivate: [AuthGuard], data: { permissionRoute: '/materiale' } },
  { path: 'schela', component: SchelaComponent, canActivate: [AuthGuard], data: { permissionRoute: '/schela' } },
  { path: 'unelte', component: UnelteComponent, canActivate: [AuthGuard], data: { permissionRoute: '/unelte' } },
  { path: 'unelte/adauga-unealta', component: AdaugaUnealtaComponent, canActivate: [AuthGuard], data: { permissionRoute: '/unelte/adauga-unealta' } },
  { path: 'predare-unealta', component: PredareUnealtaComponent, canActivate: [AuthGuard], data: { permissionRoute: '/predare-unealta' } },
  { path: 'history', component: HistoryComponent, canActivate: [AuthGuard], data: { permissionRoute: '/history' } },
  { path: 'rafturi', component: ShelfsComponent, canActivate: [AuthGuard], data: { permissionRoute: '/rafturi' } },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard], data: { permissionRoute: '/dashboard' } },

  // 404 → pontaj (va declanșa și guard-ul)
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes), ZXingScannerModule],
  exports: [RouterModule],
})
export class AppRoutingModule {}
