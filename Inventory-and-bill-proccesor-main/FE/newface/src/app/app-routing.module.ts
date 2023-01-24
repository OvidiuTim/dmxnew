import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import {MagazieComponent} from './magazie/magazie.component';
import { AngajatiComponent } from './magazie/angajati/angajati.component';
import { MaterialeComponent } from './magazie/materiale/materiale.component';
import { SchelaComponent } from './magazie/schela/schela.component';
import { UnelteComponent } from './magazie/unelte/unelte.component';
import { AdministratorComponent } from './administrator/administrator.component';



const routes: Routes = [
  {path:'magazie',component:MagazieComponent},
  {path:'angajati',component:AngajatiComponent},
  {path:'materiale',component:MaterialeComponent},
  {path:'schela',component:SchelaComponent},
  {path:'unelte',component:UnelteComponent},
  {path:'admin',component:AdministratorComponent},
  
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  
})
export class AppRoutingModule { }
