import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { MagazieComponent } from './magazie/magazie.component';
import { AngajatiComponent } from './magazie/angajati/angajati.component';
import { UnelteComponent } from './magazie/unelte/unelte.component';
import { MaterialeComponent } from './magazie/materiale/materiale.component';
import { SchelaComponent } from './magazie/schela/schela.component';
import { ModalUnelteComponent } from './magazie/angajati/modal-unelte/modal-unelte.component';
import { ModalMaterialeComponent } from './magazie/angajati/modal-materiale/modal-materiale.component';
import { ModalSchelaComponent } from './magazie/angajati/modal-schela/modal-schela.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    MagazieComponent,
    AngajatiComponent,
    UnelteComponent,
    MaterialeComponent,
    SchelaComponent,
    ModalUnelteComponent,
    ModalMaterialeComponent,
    ModalSchelaComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
