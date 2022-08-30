import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import {UserComponent} from './user/user.component';
import {ToolComponent} from './tool/tool.component';
import {HistoryComponent} from './history/history.component';
import {MaterialComponent} from './material/material.component';
import {ConsumableComponent} from './consumable/consumable.component';
import { ShedComponent } from './shed/shed.component';
import { WorkfieldComponent } from './workfield/workfield.component';
import { UnfunctionalComponent } from './unfunctional/unfunctional.component';
import { TaketoolComponent } from './taketool/taketool.component';
import { GivetoolComponent } from './givetool/givetool.component';
import { ColajmetalicComponent } from './colajmetalic/colajmetalic.component';
import { ColajtipdokaComponent } from './colajtipdoka/colajtipdoka.component';
import { PopiComponent } from './popi/popi.component';
import { SchelausoaraComponent } from './schelausoara/schelausoara.component';
import { SchelafatadaComponent } from './schelafatada/schelafatada.component';
import { SchelafatadamodularaComponent } from './schelafatadamodulara/schelafatadamodulara.component';
import { MijloacefixeComponent } from './mijloacefixe/mijloacefixe.component';

const routes: Routes = [
  {path:'user',component:UserComponent},
  {path:'tool',component:ToolComponent},
  {path:'history',component:HistoryComponent},
  {path:'material',component:MaterialComponent},
  {path:'shed',component:ShedComponent},
  {path:'workfield',component:WorkfieldComponent},
  {path:'unfunctional',component:UnfunctionalComponent},
  {path:'consumable',component:ConsumableComponent},
  {path:'taketool',component:TaketoolComponent},
  {path:'givetool',component:GivetoolComponent},
  {path:'cofrajmetalic',component:ColajmetalicComponent},
  {path: 'cofrajtipdoka', component:ColajtipdokaComponent},
  {path: 'popi', component:PopiComponent},
  {path: 'schelausoara', component:SchelausoaraComponent},
  {path: 'schelafatada', component:SchelafatadaComponent},
  {path: 'schelafatadamodulara', component:SchelafatadamodularaComponent},
  {path: 'mijloacefixe', component:MijloacefixeComponent}

  ];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
