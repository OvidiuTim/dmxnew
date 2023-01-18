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

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    MagazieComponent,
    AngajatiComponent,
    UnelteComponent,
    MaterialeComponent,
    SchelaComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
