import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SharedService {
  readonly APIUrl = "http://127.0.0.1:8000";

  constructor(private http:HttpClient)  { }

  admin:boolean=false;
  allowthis:boolean=false;
  selectedUser:any
  selectedUserPin:any

  username !: string;


    //anagajati api
    getUsrList():Observable<any[]>{
      return this.http.get<any[]>(this.APIUrl + '/user/');
    }  
  
    addUser(val:any){
      return this.http.post(this.APIUrl + '/user/',val);
    }
  
    updateUser(val:any){
      return this.http.put(this.APIUrl + '/user/',val);
    }
  
    deleteUser(val:any){
      return this.http.delete(this.APIUrl + '/user/'+val);
    }

  //unelte api
  getTolList():Observable<any[]>{
    return this.http.get<any[]>(this.APIUrl + '/tool/');
  }

  addTool(val:any){
    return this.http.post(this.APIUrl + '/tool/',val);
  }

  updateTool(val:any){
    return this.http.put(this.APIUrl + '/tool/',val);
  }


  deleteTool(val:any){
    return this.http.delete(this.APIUrl + '/tool/'+val);
  }

  //istoric api
  getHisList():Observable<any[]>{
    return this.http.get<any[]>(this.APIUrl + '/history/');
  }

  addHistory(val:any){
    return this.http.post(this.APIUrl + '/history/',val);
  }

  updateHistory(val:any){
    return this.http.put(this.APIUrl + '/history/',val);
  }


  deleteHistory(val:any){
    return this.http.delete(this.APIUrl + '/history/'+val);
  }

    //material api
    getMatList():Observable<any[]>{
      return this.http.get<any[]>(this.APIUrl + '/material/');
    }
    
    addMaterial(val:any){
      return this.http.post(this.APIUrl + '/material/',val);
    }
    
    updateMaterial(val:any){
      return this.http.put(this.APIUrl + '/material/',val);
    }
    
    
    deleteMaterial(val:any){
      return this.http.delete(this.APIUrl + '/material/'+val);
      }


//consumabile api
getConList():Observable<any[]>{
  return this.http.get<any[]>(this.APIUrl + '/consumable/');
}

addConsumable(val:any){
  return this.http.post(this.APIUrl + '/consumable/',val);
}

updateConsumable(val:any){
  return this.http.put(this.APIUrl + '/consumable/',val);
}


deleteConsumable(val:any){
  return this.http.delete(this.APIUrl + '/consumable/'+val);
}

      


//cofraj metalic api
getCofMetList():Observable<any[]>{
  return this.http.get<any[]>(this.APIUrl + '/cofrajmetalic/');
}

addCofMet(val:any){
  return this.http.post(this.APIUrl + '/cofrajmetalic/',val);
}

updateCofMet(val:any){
  return this.http.put(this.APIUrl + '/cofrajmetalic/',val);
}


deleteCofMet(val:any){
  return this.http.delete(this.APIUrl + '/cofrajmetalic/'+val);
}


//cofraj tip doka api
getDokaList():Observable<any[]>{
return this.http.get<any[]>(this.APIUrl + '/cofrajtipdoka/');
}

addDoka(val:any){
return this.http.post(this.APIUrl + '/cofrajtipdoka/',val);
}

updateDoka(val:any){
return this.http.put(this.APIUrl + '/cofrajtipdoka/',val);
}


deleteDoka(val:any){
return this.http.delete(this.APIUrl + '/cofrajtipdoka/'+val);
}


//popi api
getpopi():Observable<any[]>{
return this.http.get<any[]>(this.APIUrl + '/popi/');
}

addpopi(val:any){
return this.http.post(this.APIUrl + '/popi/',val);
}

updatepopi(val:any){
return this.http.put(this.APIUrl + '/popi/',val);
}


deletepopi(val:any){
return this.http.delete(this.APIUrl + '/popi/'+val);
}

//schelausoara api
getschelausoara():Observable<any[]>{
return this.http.get<any[]>(this.APIUrl + '/schelausoara/');
}

addschelausoara(val:any){
return this.http.post(this.APIUrl + '/schelausoara/',val);
}

updateschelausoara(val:any){
return this.http.put(this.APIUrl + '/schelausoara/',val);
}


deleteschelausoara(val:any){
return this.http.delete(this.APIUrl + '/schelausoara/'+val);
}


//fatada api
getschelafatada():Observable<any[]>{
return this.http.get<any[]>(this.APIUrl + '/schelafatada/');
}

addschelafatada(val:any){
return this.http.post(this.APIUrl + '/schelafatada/',val);
}

updateschelafatada(val:any){
return this.http.put(this.APIUrl + '/schelafatada/',val);
}


deleteschelafatada(val:any){
return this.http.delete(this.APIUrl + '/schelafatada/'+val);
}

//s fatada modulara api
getschelafatadaM():Observable<any[]>{
return this.http.get<any[]>(this.APIUrl + '/schelafatadamodulara/');
}

addschelafatadaM(val:any){
return this.http.post(this.APIUrl + '/schelafatadamodulara/',val);
}

updateschelafatadaM(val:any){
return this.http.put(this.APIUrl + '/schelafatadamodulara/',val);
}


deleteschelafatadaM(val:any){
return this.http.delete(this.APIUrl + '/schelafatadamodulara/'+val);
}

//s istoric
getistoricM():Observable<any[]>{
return this.http.get<any[]>(this.APIUrl + '/istoric_schele/');
}

addistoricM(val:any){
return this.http.post(this.APIUrl + '/istoric_schele/',val);
}

updateistoricM(val:any){
return this.http.put(this.APIUrl + '/istoric_schele/',val);
}


deleteistoricM(val:any){
return this.http.delete(this.APIUrl + '/istoric_schele/'+val);
}

//mijloace api
getmijloace():Observable<any[]>{
return this.http.get<any[]>(this.APIUrl + '/mijloacefixe/');
}

addmijloace(val:any){
return this.http.post(this.APIUrl + '/mijloacefixe/',val);
}

updatemijloace(val:any){
return this.http.put(this.APIUrl + '/mijloacefixe/',val);
}


deleteMijloace(val:any){
return this.http.delete(this.APIUrl + '/mijloacefixe/'+val);
}

// --- Pontaj API ---

/** Raport pe o zi: /api/pontaj/day/?date=YYYY-MM-DD  (dacă nu dai date, folosește azi) */
getAttendanceDay(date?: string){
  const url = `${this.APIUrl}/api/pontaj/day/` + (date ? `?date=${date}` : '');
  return this.http.get<any>(url);
}

/** Cine e IN acum: /api/pontaj/present/ */
getAttendancePresent(){
  return this.http.get<any>(`${this.APIUrl}/api/pontaj/present/`);
}

/** Sumar pe interval: /api/pontaj/range/?start=YYYY-MM-DD&end=YYYY-MM-DD */
getAttendanceRange(start: string, end: string){
  const url = `${this.APIUrl}/api/pontaj/range/?start=${start}&end=${end}`;
  return this.http.get<any>(url);
}

/** Sumar pe interval pentru un user: /api/pontaj/range/?start=YYYY-MM-DD&end=YYYY-MM-DD&user_id=ID */
getAttendanceRangeForUser(start: string, end: string, userId: number){
  const url = `${this.APIUrl}/api/pontaj/range/?start=${start}&end=${end}&user_id=${userId}`;
  return this.http.get<any>(url);
}

}
