import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { UserComponent } from './user/user.component';
import { ShowUsrComponent } from './user/show-usr/show-usr.component';
import { AddEditUsrComponent } from './user/add-edit-usr/add-edit-usr.component';
import { ToolComponent } from './tool/tool.component';
import { ShowTolComponent } from './tool/show-tol/show-tol.component';
import { AddEditTolComponent } from './tool/add-edit-tol/add-edit-tol.component';
import { HistoryComponent } from './history/history.component';
import { ShowHisComponent } from './history/show-his/show-his.component';
import { AddEditHisComponent } from './history/add-edit-his/add-edit-his.component';
import {SharedService} from './shared.service';
import {DatePipe} from '@angular/common';

import {HttpClientModule} from '@angular/common/http';
import {FormsModule,ReactiveFormsModule} from '@angular/forms';
import { UsrHisComponent } from './user/usr-his/usr-his.component';
import { MaterialComponent } from './material/material.component';
import { ShowMatComponent } from './material/show-mat/show-mat.component';
import { AddMatComponent } from './material/add-mat/add-mat.component';
import { RemoveMatComponent } from './material/remove-mat/remove-mat.component';
import { NewMatComponent } from './material/new-mat/new-mat.component';
import { ConsumableComponent } from './consumable/consumable.component';
import { ShowConComponent } from './consumable/show-con/show-con.component';
import { JustEditTolComponent } from './tool/give-tol-to-user/just-edit-tol.component';
import { ServiceTolComponent } from './tool/service-tol/service-tol.component';
import { ShowServiceComponent } from './tool/show-service/show-service.component';
import { ShowProviderComponent } from './material/show-provider/show-provider.component';
import { TakeTolFromUserComponent } from './tool/take-tol-from-user/take-tol-from-user.component';
import { ShedComponent } from './shed/shed.component';
import { ShowShedComponent } from './shed/show-shed/show-shed.component';
import { ShedToWorkplaceComponent } from './shed/shed-to-workplace/shed-to-workplace.component';
import { WorkfieldComponent } from './workfield/workfield.component';
import { ShowWorkfieldComponent } from './workfield/show-workfield/show-workfield.component';
import { WorkfieldToShedComponent } from './workfield/workfield-to-shed/workfield-to-shed.component';
import { UnfunctionalComponent } from './unfunctional/unfunctional.component';
import { ServiceOperationsComponent } from './unfunctional/service-operations/service-operations.component';
import { ShedToUnfunctionalComponent } from './shed/shed-to-unfunctional/shed-to-unfunctional.component';
import { UnfunctionalToShedComponent } from './unfunctional/unfunctional-to-shed/unfunctional-to-shed.component';
import { TaketoolComponent } from './taketool/taketool.component';
import { GivetoolComponent } from './givetool/givetool.component';
import { SelectedUserComponent } from './taketool/selected-user/selected-user.component';
import { PopiComponent } from './popi/popi.component';
import { AddPopiComponent } from './popi/add-popi/add-popi.component';
import { CombustibilComponent } from './combustibil/combustibil.component';
import { AddCombustibilComponent } from './combustibil/add-combustibil/add-combustibil.component';
import { ColajmetalicComponent } from './colajmetalic/colajmetalic.component';
import { AddcolajmetalicComponent } from './colajmetalic/addcolajmetalic/addcolajmetalic.component';
import { ColajtipdokaComponent } from './colajtipdoka/colajtipdoka.component';
import { AddcolajtipdokaComponent } from './colajtipdoka/addcolajtipdoka/addcolajtipdoka.component';
import { EditColajMetalicComponent } from './colajmetalic/edit-colaj-metalic/edit-colaj-metalic.component';
import { EditcolajtipdokaComponent } from './colajtipdoka/editcolajtipdoka/editcolajtipdoka.component';
import { EditpopiComponent } from './popi/editpopi/editpopi.component';
import { SchelausoaraComponent } from './schelausoara/schelausoara.component';
import { AddschelausoaraComponent } from './schelausoara/addschelausoara/addschelausoara.component';
import { EditschelausoaraComponent } from './schelausoara/editschelausoara/editschelausoara.component';
import { SchelafatadaComponent } from './schelafatada/schelafatada.component';
import { AddschelafatadaComponent } from './schelafatada/addschelafatada/addschelafatada.component';
import { EditschelafatadaComponent } from './schelafatada/editschelafatada/editschelafatada.component';
import { SchelafatadamodularaComponent } from './schelafatadamodulara/schelafatadamodulara.component';
import { AddsfmodularaComponent } from './schelafatadamodulara/addsfmodulara/addsfmodulara.component';
import { EditsfmodularaComponent } from './schelafatadamodulara/editsfmodulara/editsfmodulara.component';
import { MijloacefixeComponent } from './mijloacefixe/mijloacefixe.component';
import { AddMijloaceComponent } from './mijloacefixe/add-mijloace/add-mijloace.component';
import { EditmijloaceComponent } from './mijloacefixe/editmijloace/editmijloace.component';




@NgModule({
  
  declarations: [
    AppComponent,
    UserComponent,
    ShowUsrComponent,
    AddEditUsrComponent,
    ToolComponent,
    ShowTolComponent,
    AddEditTolComponent,
    HistoryComponent,
    ShowHisComponent,
    AddEditHisComponent,
    UsrHisComponent,
    MaterialComponent,
    ShowMatComponent,
    AddMatComponent,
    RemoveMatComponent,
    NewMatComponent,
    ConsumableComponent,
    ShowConComponent,
    JustEditTolComponent,
    ServiceTolComponent,
    ShowServiceComponent,
    ShowProviderComponent,
    TakeTolFromUserComponent,
    ShedComponent,
    ShowShedComponent,
    ShedToWorkplaceComponent,
    WorkfieldComponent,
    ShowWorkfieldComponent,
    WorkfieldToShedComponent,
    UnfunctionalComponent,
    ServiceOperationsComponent,
    ShedToUnfunctionalComponent,
    UnfunctionalToShedComponent,
    TaketoolComponent,
    GivetoolComponent,
    SelectedUserComponent,
    PopiComponent,
    AddPopiComponent,
    CombustibilComponent,
    AddCombustibilComponent,
    ColajmetalicComponent,
    AddcolajmetalicComponent,
    ColajtipdokaComponent,
    AddcolajtipdokaComponent,
    EditColajMetalicComponent,
    EditcolajtipdokaComponent,
    EditpopiComponent,
    SchelausoaraComponent,
    AddschelausoaraComponent,
    EditschelausoaraComponent,
    SchelafatadaComponent,
    AddschelafatadaComponent,
    EditschelafatadaComponent,
    SchelafatadamodularaComponent,
    AddsfmodularaComponent,
    EditsfmodularaComponent,
    MijloacefixeComponent,
    AddMijloaceComponent,
    EditmijloaceComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [SharedService,DatePipe],
  bootstrap: [AppComponent]
})
export class AppModule { }
