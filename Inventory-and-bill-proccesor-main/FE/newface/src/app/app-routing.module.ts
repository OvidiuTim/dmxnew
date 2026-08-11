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
import { AccommodationsComponent } from './pontaj/accommodations/accommodations.component';
import { LeaveRequestsComponent } from './pontaj/leave-requests/leave-requests.component';

import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
  // Login deschis
  { path: 'login', component: LoginComponent },
  { path: 'no-access', component: NoAccessComponent },
  { path: 'admin-app-page', component: AdminAppPageComponent },

  // După autentificare intrarea principală este Dashboard.
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Pontaj protejat (fallback dacă ai linkuri către /pontaj/pontaj)
  { path: 'pontaj', component: PontajComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj', moduleCode: 'attendance', moduleEntry: true } },

  // Pontaj manual separat
  { path: 'clockinandout', component: ClockinandoutComponent },
  { path: 'clockinandoutdriver', component: ClockinandoutdriverComponent },

  // Pontaj protejat (fallback dacă ai linkuri către /pontaj/pontaj)
  { path: 'pontaj/rapoarte', component: RapoarteComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/rapoarte', moduleCode: 'attendance' } },
  { path: 'pontaj/fisa-angajat', component: FisaAngajatComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/fisa-angajat', moduleCode: 'attendance' } },
  { path: 'pontaj/fisa-angajat/:id', component: FisaAngajatComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/fisa-angajat', moduleCode: 'attendance' } },
  { path: 'pontaj/cazari', component: AccommodationsComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/cazari', moduleCode: 'attendance' } },
  { path: 'pontaj/echipe', component: TeamsWorkspaceComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/echipe', moduleCode: 'teams_schedule', teamMode: 'permanent' } },
  { path: 'pontaj/echipa-mea', component: TeamsWorkspaceComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/echipa-mea', moduleCode: 'teams_schedule', teamMode: 'mine' } },
  { path: 'pontaj/echipe-azi', component: TeamsWorkspaceComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/echipe-azi', moduleCode: 'teams_schedule', teamMode: 'today' } },
  { path: 'pontaj/personal-disponibil', component: TeamsWorkspaceComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/personal-disponibil', moduleCode: 'teams_schedule', teamMode: 'available' } },
  { path: 'pontaj/concedii', component: LeaveRequestsComponent, canActivate: [AuthGuard], data: { permissionRoute: '/pontaj/concedii', moduleCode: 'teams_schedule' } },
  {
    path: 'hr/documente', component: PortalPlaceholderComponent, canActivate: [AuthGuard],
    data: {
      permissionRoute: '/hr/documente', moduleCode: 'human_resources', title: 'Documente angajați', icon: 'document',
      description: 'Evidența documentelor și a termenelor de valabilitate pentru personal.',
      missingData: 'Nu există în serviciul frontend endpoint-uri confirmate pentru documente, tipuri de document și expirări.'
    }
  },

  // Formular angajat
  { path: 'users/new', component: EmployeeFormComponent, canActivate: [AuthGuard], data: { permissionRoute: '/users/new', moduleCode: 'attendance', requiresGranular: true } },
  { path: 'users/:id/edit', component: EmployeeFormComponent, canActivate: [AuthGuard], data: { permissionRoute: '/user/:id', moduleCode: 'attendance', requiresGranular: true } },

  // Pagina utilizator protejată (/pontaj/user/:id)
  { path: 'user/:id', component: UserpontatComponent, canActivate: [AuthGuard], data: { permissionRoute: '/user/:id', moduleCode: 'attendance', requiresGranular: true } },

  { path: 'magazie', component: MagazieComponent, canActivate: [AuthGuard], data: { permissionRoute: '/magazie', moduleCode: 'warehouse' } },
  {
    path: 'magazie/scule', component: InventoryCatalogComponent, canActivate: [AuthGuard],
    data: { permissionRoute: '/magazie/scule', moduleCode: 'warehouse', isSsm: false, title: 'Scule', description: 'Inventarul sculelor de șantier, separat de echipamentele pentru protecția muncii.' }
  },
  {
    path: 'magazie/echipamente-ssm', component: InventoryCatalogComponent, canActivate: [AuthGuard],
    data: { permissionRoute: '/magazie/echipamente-ssm', moduleCode: 'warehouse', isSsm: true, title: 'Echipamente SSM', description: 'Echipamentele individuale de protecție urmărite separat prin marcajul SSM din backend.' }
  },
  { path: 'magazie/istoric', component: InventoryHistoryComponent, canActivate: [AuthGuard], data: { permissionRoute: '/magazie/istoric', moduleCode: 'warehouse' } },
  { path: 'angajati', component: AngajatiComponent, canActivate: [AuthGuard], data: { permissionRoute: '/angajati', moduleCode: 'warehouse', requiresGranular: true } },
  { path: 'materiale', component: MaterialeComponent, canActivate: [AuthGuard], data: { permissionRoute: '/materiale', moduleCode: 'warehouse', requiresGranular: true } },
  { path: 'schela', component: SchelaComponent, canActivate: [AuthGuard], data: { permissionRoute: '/schela', moduleCode: 'warehouse', requiresGranular: true } },
  { path: 'unelte', component: UnelteComponent, canActivate: [AuthGuard], data: { permissionRoute: '/unelte', moduleCode: 'tools' } },
  { path: 'unelte/adauga-unealta', component: AdaugaUnealtaComponent, canActivate: [AuthGuard], data: { permissionRoute: '/unelte/adauga-unealta', moduleCode: 'tools' } },
  { path: 'predare-unealta', component: PredareUnealtaComponent, canActivate: [AuthGuard], data: { permissionRoute: '/predare-unealta', moduleCode: 'tools' } },
  { path: 'history', component: HistoryComponent, canActivate: [AuthGuard], data: { permissionRoute: '/history', moduleCode: 'warehouse', requiresGranular: true } },
  { path: 'rafturi', component: ShelfsComponent, canActivate: [AuthGuard], data: { permissionRoute: '/rafturi', moduleCode: 'warehouse', requiresGranular: true } },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard], data: { permissionRoute: '/dashboard', moduleCode: 'attendance' } },

  // 404 → dashboard
  { path: '**', redirectTo: 'dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' }), ZXingScannerModule],
  exports: [RouterModule],
})
export class AppRoutingModule {}
