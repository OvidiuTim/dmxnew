import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SharedService {
  // aceeași origine + prefix '/api'
  private readonly API = (typeof window !== 'undefined' ? window.location.origin : '') + '/api';

  constructor(private http: HttpClient) {}

  admin = false;
  allowthis = false;
  selectedUser: any;
  selectedUserPin: any;
  username!: string;

  // --- Angajați ---
  getUsrList(): Observable<any[]>      { return this.http.get<any[]>(`${this.API}/user/`); }
  addUser(val: any)                    { return this.http.post(`${this.API}/user/`, val); }
  updateUser(val: any)                 { return this.http.put(`${this.API}/user/`, val); }
  deleteUser(id: any)                  { return this.http.delete(`${this.API}/user/${id}`); }

  // --- Unelte ---
  getTolList(): Observable<any[]>      { return this.http.get<any[]>(`${this.API}/tool/`); }
  addTool(val: any)                    { return this.http.post(`${this.API}/tool/`, val); }
  updateTool(val: any)                 { return this.http.put(`${this.API}/tool/`, val); }
  deleteTool(id: any)                  { return this.http.delete(`${this.API}/tool/${id}`); }

  // --- Istoric ---
  getHisList(): Observable<any[]>      { return this.http.get<any[]>(`${this.API}/history/`); }
  addHistory(val: any)                 { return this.http.post(`${this.API}/history/`, val); }
  updateHistory(val: any)              { return this.http.put(`${this.API}/history/`, val); }
  deleteHistory(id: any)               { return this.http.delete(`${this.API}/history/${id}`); }

  // --- Materiale / Consumabile ---
  getMatList(): Observable<any[]>      { return this.http.get<any[]>(`${this.API}/material/`); }
  addMaterial(val: any)                { return this.http.post(`${this.API}/material/`, val); }
  updateMaterial(val: any)             { return this.http.put(`${this.API}/material/`, val); }
  deleteMaterial(id: any)              { return this.http.delete(`${this.API}/material/${id}`); }

  getConList(): Observable<any[]>      { return this.http.get<any[]>(`${this.API}/consumable/`); }
  addConsumable(val: any)              { return this.http.post(`${this.API}/consumable/`, val); }
  updateConsumable(val: any)           { return this.http.put(`${this.API}/consumable/`, val); }
  deleteConsumable(id: any)            { return this.http.delete(`${this.API}/consumable/${id}`); }

  // --- Schele / Popi / Cofraje / Mijloace fixe (toate cu /api/) ---
  getCofMetList()                      { return this.http.get<any[]>(`${this.API}/cofrajmetalic/`); }
  addCofMet(v: any)                    { return this.http.post(`${this.API}/cofrajmetalic/`, v); }
  updateCofMet(v: any)                 { return this.http.put(`${this.API}/cofrajmetalic/`, v); }
  deleteCofMet(id: any)                { return this.http.delete(`${this.API}/cofrajmetalic/${id}`); }

  getDokaList()                        { return this.http.get<any[]>(`${this.API}/cofrajtipdoka/`); }
  addDoka(v: any)                      { return this.http.post(`${this.API}/cofrajtipdoka/`, v); }
  updateDoka(v: any)                   { return this.http.put(`${this.API}/cofrajtipdoka/`, v); }
  deleteDoka(id: any)                  { return this.http.delete(`${this.API}/cofrajtipdoka/${id}`); }

  getpopi()                            { return this.http.get<any[]>(`${this.API}/popi/`); }
  addpopi(v: any)                      { return this.http.post(`${this.API}/popi/`, v); }
  updatepopi(v: any)                   { return this.http.put(`${this.API}/popi/`, v); }
  deletepopi(id: any)                  { return this.http.delete(`${this.API}/popi/${id}`); }

  getschelausoara()                    { return this.http.get<any[]>(`${this.API}/schelausoara/`); }
  addschelausoara(v: any)              { return this.http.post(`${this.API}/schelausoara/`, v); }
  updateschelausoara(v: any)           { return this.http.put(`${this.API}/schelausoara/`, v); }
  deleteschelausoara(id: any)          { return this.http.delete(`${this.API}/schelausoara/${id}`); }

  getschelafatada()                    { return this.http.get<any[]>(`${this.API}/schelafatada/`); }
  addschelafatada(v: any)              { return this.http.post(`${this.API}/schelafatada/`, v); }
  updateschelafatada(v: any)           { return this.http.put(`${this.API}/schelafatada/`, v); }
  deleteschelafatada(id: any)          { return this.http.delete(`${this.API}/schelafatada/${id}`); }

  getschelafatadaM()                   { return this.http.get<any[]>(`${this.API}/schelafatadamodulara/`); }
  addschelafatadaM(v: any)             { return this.http.post(`${this.API}/schelafatadamodulara/`, v); }
  updateschelafatadaM(v: any)          { return this.http.put(`${this.API}/schelafatadamodulara/`, v); }
  deleteschelafatadaM(id: any)         { return this.http.delete(`${this.API}/schelafatadamodulara/${id}`); }

  getistoricM()                        { return this.http.get<any[]>(`${this.API}/istoric_schele/`); }
  addistoricM(v: any)                  { return this.http.post(`${this.API}/istoric_schele/`, v); }
  updateistoricM(v: any)               { return this.http.put(`${this.API}/istoric_schele/`, v); }
  deleteistoricM(id: any)              { return this.http.delete(`${this.API}/istoric_schele/${id}`); }

  getmijloace()                        { return this.http.get<any[]>(`${this.API}/mijloacefixe/`); }
  addmijloace(v: any)                  { return this.http.post(`${this.API}/mijloacefixe/`, v); }
  updatemijloace(v: any)               { return this.http.put(`${this.API}/mijloacefixe/`, v); }
  deleteMijloace(id: any)              { return this.http.delete(`${this.API}/mijloacefixe/${id}`); }

  // --- Pontaj ---
  getAttendanceDay(date?: string)      { return this.http.get(`${this.API}/pontaj/day/`,     { params: date ? { date } : {} }); }
  getAttendancePresent()               { return this.http.get(`${this.API}/pontaj/present/`); }
  getAttendanceRange(start: string, end: string) {
    return this.http.get(`${this.API}/pontaj/range/`, { params: { start, end } });
  }
  getAttendanceRangeForUser(start: string, end: string, userId: number) {
    return this.http.get(`${this.API}/pontaj/range/`, { params: { start, end, user_id: userId } });
  }

  // SSE (dacă îl folosești în FE)
  readonly pontajStreamUrl = `${this.API}/pontaj/stream/`;
}
