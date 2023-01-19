import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {MagazieComponent} from './magazie/magazie.component';
import { AngajatiComponent } from './magazie/angajati/angajati.component';



const routes: Routes = [
  {path:'magazie',component:MagazieComponent},
  {path:'angajati',component:AngajatiComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
