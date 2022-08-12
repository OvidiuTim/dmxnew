import { Injectable } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class SharedService {
readonly APIUrl = "http://127.0.0.1:8000";

constructor(private http:HttpClient) { }

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

  //api magazie

  getShedList():Observable<any[]>{
    return this.http.get<any[]>(this.APIUrl + '/shed/');
  }  


  addShed(val:any){
    return this.http.post(this.APIUrl + '/shed/',val);
  }

  updateShed(val:any){
    return this.http.put(this.APIUrl + '/shed/',val);
  }

  deleteShed(val:any){
    return this.http.delete(this.APIUrl + '/shed/'+val);
  }

  //api santier

  getWfList():Observable<any[]>{
    return this.http.get<any[]>(this.APIUrl + '/workfield/');
  } 

  addWorkfield(val:any){
    return this.http.post(this.APIUrl + '/workfield/',val);
  }

  updateWorkfield(val:any){
    return this.http.put(this.APIUrl + '/workfield/',val);
  }

  deleteWorkfield(val:any){
    return this.http.delete(this.APIUrl + '/workfield/'+val);
  }

//api service

  getUnfunctList():Observable<any[]>{
    return this.http.get<any[]>(this.APIUrl + '/unfunctional/');
  } 

  addUnfunctional(val:any){
    return this.http.post(this.APIUrl + '/unfunctional/',val);
  }

  updateUnfunctional(val:any){
    return this.http.put(this.APIUrl + '/unfunctional/',val);
  }

  deleteUnfunctional(val:any){
    return this.http.delete(this.APIUrl + '/unfunctional/'+val);
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

  //extra
  getAllUserNames():Observable<any[]>{
    return this.http.get<any[]>(this.APIUrl+'/user/');
  }
  
  getAllUserPin():Observable<any[]>{
    return this.http.get<any[]>(this.APIUrl+'/user/');
  }
  
  getAllTools():Observable<any[]>{
    return this.http.get<any[]>(this.APIUrl+'/shed/');
  }

  getAllUser():Observable<any[]>{
    return this.http.get<any[]>(this.APIUrl+'/history/');
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

}