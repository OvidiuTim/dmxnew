import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

import { MagazieComponent } from './magazie/magazie.component';
import { AngajatiComponent } from './magazie/angajati/angajati.component';
import { MaterialeComponent } from './magazie/materiale/materiale.component';
import { SchelaComponent } from './magazie/schela/schela.component';
import { UnelteComponent } from './magazie/unelte/unelte.component';
import { LoginComponent } from './login/login.component';
import { HistoryComponent } from './magazie/history/history.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ShelfsComponent } from './shelfs/shelfs.component';
import { PontajComponent } from './pontaj/pontaj.component';
import { UserpontatComponent } from './pontaj/userpontat/userpontat.component';

import { AuthGuard } from './auth/auth.guard';

const routes: Routes = [
  // Login deschis
  { path: 'login', component: LoginComponent },

  // Pontaj protejat (acoperă /pontaj/ - ruta goală)
  { path: '', component: PontajComponent, pathMatch: 'full', canActivate: [AuthGuard] },

  // Pontaj protejat (fallback dacă ai linkuri către /pontaj/pontaj)
  { path: 'pontaj', component: PontajComponent, canActivate: [AuthGuard] },

  // Pagina utilizator protejată (/pontaj/user/:id)
  { path: 'user/:id', component: UserpontatComponent, canActivate: [AuthGuard] },

  // Restul rutelor rămân neprotejate (cum le aveai)
  { path: 'magazie', component: MagazieComponent },
  { path: 'angajati', component: AngajatiComponent },
  { path: 'materiale', component: MaterialeComponent },
  { path: 'schela', component: SchelaComponent },
  { path: 'unelte', component: UnelteComponent },
  { path: 'history', component: HistoryComponent },
  { path: 'rafturi', component: ShelfsComponent },
  { path: 'dashboard', component: DashboardComponent },

  // 404 → pontaj (va declanșa și guard-ul)
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes), ZXingScannerModule],
  exports: [RouterModule],
})
export class AppRoutingModule {}
