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

      
}
