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
import { PortalPlaceholderComponent } from './portal-placeholder/portal-placeholder.component';
import { InventoryCatalogComponent } from './inventory-catalog/inventory-catalog.component';
import { InventoryHistoryComponent } from './inventory-history/inventory-history.component';
import { TeamsWorkspaceComponent } from './teams/teams-workspace.component';

import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
  // Login deschis
  { path: 'login', component: LoginComponent },
  { path: 'no-access', component: NoAccessComponent },
  { path: 'admin-app-page', component: AdminAppPageComponent },

  // După autentificare intrarea principală este Dashboard.
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Pontaj protejat (fallback dacă ai linkuri către /pontaj/pontaj)
  { path: 'pontaj', component: PontajComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj' } },

  // Pontaj manual separat
  { path: 'clockinandout', component: ClockinandoutComponent },
  { path: 'clockinandoutdriver', component: ClockinandoutdriverComponent },

  // Pontaj protejat (fallback dacă ai linkuri către /pontaj/pontaj)
  { path: 'pontaj/rapoarte', component: RapoarteComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/rapoarte' } },
  { path: 'pontaj/fisa-angajat', component: FisaAngajatComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/fisa-angajat' } },
  { path: 'pontaj/fisa-angajat/:id', component: FisaAngajatComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/fisa-angajat' } },
  { path: 'pontaj/echipe', component: TeamsWorkspaceComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/echipe', teamMode: 'permanent' } },
  { path: 'pontaj/echipe-azi', component: TeamsWorkspaceComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/echipe-azi', teamMode: 'today' } },
  { path: 'pontaj/personal-disponibil', component: TeamsWorkspaceComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/personal-disponibil', teamMode: 'available' } },
  {
    path: 'pontaj/concedii', component: PortalPlaceholderComponent, canActivate: [AuthGuard],
    data: {
      permissionRoute: '/pontaj', title: 'Concedii și absențe', icon: 'calendar',
      description: 'Administrarea cererilor, zilelor de concediu și absențelor într-un singur loc.',
      missingData: 'Modelele LeaveDay și LeaveRequest există în backend, însă în frontend nu există un contract API clar pentru listare și aprobare.'
    }
  },
  {
    path: 'hr/documente', component: PortalPlaceholderComponent, canActivate: [AuthGuard],
    data: {
      permissionRoute: '/pontaj/fisa-angajat', title: 'Documente angajați', icon: 'document',
      description: 'Evidența documentelor și a termenelor de valabilitate pentru personal.',
      missingData: 'Nu există în serviciul frontend endpoint-uri confirmate pentru documente, tipuri de document și expirări.'
    }
  },

  // Formular angajat
  { path: 'users/new', component: EmployeeFormComponent, canActivate: [AuthGuard], data: { permissionRoute: '/users/new' } },
  { path: 'users/:id/edit', component: EmployeeFormComponent, canActivate: [AuthGuard], data: { permissionRoute: '/user/:id' } },

  // Pagina utilizator protejată (/pontaj/user/:id)
  { path: 'user/:id', component: UserpontatComponent, canActivate: [AuthGuard], data: { permissionRoute: '/user/:id' } },

  { path: 'magazie', component: MagazieComponent, canActivate: [AuthGuard], data: { permissionRoute: '/magazie' } },
  {
    path: 'magazie/scule', component: InventoryCatalogComponent, canActivate: [AuthGuard],
    data: { permissionRoute: '/unelte', isSsm: false, title: 'Scule', description: 'Inventarul sculelor de șantier, separat de echipamentele pentru protecția muncii.' }
  },
  {
    path: 'magazie/echipamente-ssm', component: InventoryCatalogComponent, canActivate: [AuthGuard],
    data: { permissionRoute: '/unelte', isSsm: true, title: 'Echipamente SSM', description: 'Echipamentele individuale de protecție urmărite separat prin marcajul SSM din backend.' }
  },
  { path: 'magazie/istoric', component: InventoryHistoryComponent, canActivate: [AuthGuard], data: { permissionRoute: '/history' } },
  { path: 'angajati', component: AngajatiComponent, canActivate: [AuthGuard], data: { permissionRoute: '/angajati' } },
  { path: 'materiale', component: MaterialeComponent, canActivate: [AuthGuard], data: { permissionRoute: '/materiale' } },
  { path: 'schela', component: SchelaComponent, canActivate: [AuthGuard], data: { permissionRoute: '/schela' } },
  { path: 'unelte', component: UnelteComponent, canActivate: [AuthGuard], data: { permissionRoute: '/unelte' } },
  { path: 'unelte/adauga-unealta', component: AdaugaUnealtaComponent, canActivate: [AuthGuard], data: { permissionRoute: '/unelte/adauga-unealta' } },
  { path: 'predare-unealta', component: PredareUnealtaComponent, canActivate: [AuthGuard], data: { permissionRoute: '/predare-unealta' } },
  { path: 'history', component: HistoryComponent, canActivate: [AuthGuard], data: { permissionRoute: '/history' } },
  { path: 'rafturi', component: ShelfsComponent, canActivate: [AuthGuard], data: { permissionRoute: '/rafturi' } },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard], data: { permissionRoute: '/dashboard' } },

  // 404 → dashboard
  { path: '**', redirectTo: 'dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' }), ZXingScannerModule],
  exports: [RouterModule],
})
export class AppRoutingModule {}
