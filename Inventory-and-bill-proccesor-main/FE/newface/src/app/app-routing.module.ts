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


const routes: Routes = [
  {path:'magazie',component:MagazieComponent},
  {path:'angajati',component:AngajatiComponent},
  {path:'materiale',component:MaterialeComponent},
  {path:'schela',component:SchelaComponent},
  {path:'unelte',component:UnelteComponent},
  {path:'history',component:HistoryComponent},
  {path:'',component:LoginComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes),ZXingScannerModule],
  exports: [RouterModule],

})
export class AppRoutingModule { }
