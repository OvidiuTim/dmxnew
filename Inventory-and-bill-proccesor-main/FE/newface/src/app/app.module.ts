import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import {HttpClientModule} from '@angular/common/http';
import {FormsModule,ReactiveFormsModule} from '@angular/forms';
import { ZXingScannerModule } from '@zxing/ngx-scanner';

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

import{ SharedService } from './shared.service';
import { HistoryComponent } from './magazie/history/history.component';
import { HSchelaComponent } from './magazie/history/h-schela/h-schela.component';

import {DatePipe} from '@angular/common';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ShelfsComponent } from './shelfs/shelfs.component';
import { NavbarComponent } from './navbar/navbar.component';

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
    ModalSchelaComponent,
    HistoryComponent,
    HSchelaComponent,
    DashboardComponent,
    ShelfsComponent,
    NavbarComponent,
  ],
  imports: [
    CommonModule,
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    ZXingScannerModule
  ],
  providers: [SharedService, DatePipe],
  bootstrap: [AppComponent]
})
export class AppModule { }
