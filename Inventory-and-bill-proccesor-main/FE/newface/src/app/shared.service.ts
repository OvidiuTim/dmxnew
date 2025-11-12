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
getAttendanceDay(date?: string) {
  // era this.http.get(`${this.API}/pontaj/day/`, ...)
  return this.http.get<any>(`${this.API}/pontaj/day/`, { params: date ? { date } : {} });
}

  getAttendancePresent()               { return this.http.get(`${this.API}/pontaj/present/`); }
  getAttendanceRange(start: string, end: string) {
    return this.http.get(`${this.API}/pontaj/range/`, { params: { start, end } });
  }
getAttendanceRangeForUser(start: string, end: string, userId: number) {
  // era this.http.get(`${this.API}/pontaj/range/`, ...)
  return this.http.get<any>(`${this.API}/pontaj/range/`, { params: { start, end, user_id: userId } });
}
  /** A) Editează o ZI prin sesiuni explicite (înlocuiește tot în ziua respectivă dacă replace=true) */
  editDaySessions(
    userId: number,
    dateISO: string,                                  // "YYYY-MM-DD"
    sessions: Array<{ in: string; out: string; worksite?: string }>, // "HH:MM" sau ISO
    opts: { replace?: boolean; rewrite_presence?: boolean; apply_grace?: boolean } = {}
  ) {
    const body = {
      user_id: userId,
      date: dateISO,
      sessions,
      replace: opts.replace ?? true,
      rewrite_presence: opts.rewrite_presence ?? true,
      apply_grace: opts.apply_grace ?? false,
    };
    return this.http.post<any>(`${this.API}/pontaj/day/edit/`, body);
  }

  /** B) Setează rapid TOTALUL pe o zi (creează 1 sesiune, cu ancorare la start/end/custom) */
// TOTAL pe zi (cu obiect opțional pentru opțiuni)
editDayTotal(
  userId: number,
  date: string,                 // "YYYY-MM-DD"
  totalHHMM: string,            // "HH:MM"
  opts?: {
    anchor?: 'start' | 'end' | 'custom';
    worksite?: string;
    customStart?: string;       // "HH:MM" dacă anchor = 'custom'
  }
) {
  const body: any = { user_id: userId, date, total_hhmm: totalHHMM };
  if (opts?.anchor)      body.anchor = opts.anchor;
  if (opts?.worksite)    body.worksite = opts.worksite;
  if (opts?.customStart) body.custom_start = opts.customStart;
  return this.http.put(`${this.API}/pontaj/day/total/`, body);
}


  /** C) Update punctual al unei sesiuni existente (nu atinge restul zilei) */
  updateSession(
    sessionId: number,
    patch: { in?: string; out?: string; worksite?: string; apply_grace?: boolean } = {}
  ) {
    const body: any = { session_id: sessionId };
    if (patch.in  !== undefined)  body.in  = patch.in;
    if (patch.out !== undefined)  body.out = patch.out;
    if (patch.worksite !== undefined) body.worksite = patch.worksite;
    if (patch.apply_grace !== undefined) body.apply_grace = patch.apply_grace;
    return this.http.post<any>(`${this.API}/pontaj/session/update/`, body);
  }

/** D) Golește/normalizează o zi rapid (șterge toate sesiunile) */
clearDay(userId: number, dateISO: string) {
  return this.editDaySessions(userId, dateISO, [], { replace: true, rewrite_presence: true });
}


  // --- Pontaj: editare o zi ---


// Șterge toată ziua
deleteDay(userId: number, date: string) {
  return this.http.request('DELETE', `${this.API}/pontaj/day/delete/`, {
    body: { user_id: userId, date }
  });
}



  // SSE (dacă îl folosești în FE)
  readonly pontajStreamUrl = `${this.API}/pontaj/stream/`;


getPayDay(userId: number, isoDate: string) {
  return this.http.get<any>(`${this.API}/pay/day/`, { params: { user_id: userId, date: isoDate }});
}
getPayMonth(userId: number, ym: string) {
  return this.http.get<any>(`${this.API}/pay/month/`, { params: { user_id: userId, month: ym }});
}

deleteSession(sessionId: number) {
  return this.http.post<any>(`${this.API}/pontaj/session/delete/`, { session_id: sessionId });
}





}


