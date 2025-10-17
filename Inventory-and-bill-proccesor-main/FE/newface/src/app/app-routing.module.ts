import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

import {MagazieComponent} from './magazie/magazie.component';
import { AngajatiComponent } from './magazie/angajati/angajati.component';
import { MaterialeComponent } from './magazie/materiale/materiale.component'
import { SchelaComponent } from './magazie/schela/schela.component';
import { UnelteComponent } from './magazie/unelte/unelte.component';
import { LoginComponent } from './login/login.component';
import { HistoryComponent } from './magazie/history/history.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ShelfsComponent } from './shelfs/shelfs.component';
import { PontajComponent } from './pontaj/pontaj.component';
import { UserpontatComponent } from './pontaj/userpontat/userpontat.component';

const routes: Routes = [
  {path:'magazie',component:MagazieComponent},
  {path:'angajati',component:AngajatiComponent},
  {path:'materiale',component:MaterialeComponent},
  {path:'schela',component:SchelaComponent},
  {path:'unelte',component:UnelteComponent},
  {path:'history',component:HistoryComponent},
  {path:'',component:DashboardComponent},
  {path:'rafturi',component:ShelfsComponent},
  {path:'pontaj',component:PontajComponent},
  {path:'pontaj/user/:id',component:UserpontatComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes),ZXingScannerModule],
  exports: [RouterModule],

})
export class AppRoutingModule { }
