import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

type ManualAttendanceOptions = {
  worksite?: string;
  mode?: 'driver' | 'manual' | 'chef';
  dataProcessingConsent?: boolean;
  attendancePhoto?: string | null;
  gps?: {
    lat: number;
    lng: number;
    accuracy?: number | null;
    capturedAt?: string | null;
  };
};

@Injectable({ providedIn: 'root' })
export class SharedService {
  // aceeași origine + prefix '/api'
  private readonly API = (typeof window !== 'undefined' ? window.location.origin : '') + '/api'; 
  //private readonly API = 'http://127.0.0.1:8000/api';
  private readonly manualDeviceStorageKey = 'clockinandout-device-key';
  constructor(private http: HttpClient) {}

  admin = false;
  allowthis = false;
  selectedUser: any;
  username!: string;

  // --- Angajați ---
  getUsrList(params?: { q?: string; person_type?: string }): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/user/`, { params: this.cleanParams(params || {}) });
  }
  getUser(id: number | string)         { return this.http.get<any>(`${this.API}/user/${id}`); }
  addUser(val: any)                    { return this.http.post(`${this.API}/user/`, val); }
  updateUser(val: any)                 { return this.http.put(`${this.API}/user/`, val); }
  setAttendanceExempt(id: number, attendanceExempt: boolean) {
    return this.http.post<any>(`${this.API}/user/${id}/attendance-exempt/`, { attendance_exempt: attendanceExempt });
  }
  deleteUser(id: any, force = false)   { return this.http.delete(`${this.API}/user/${id}${force ? '?force=1' : ''}`); }

  // --- Cazări ---
  getAccommodations()                  { return this.http.get<any>(`${this.API}/accommodations/`); }
  addAccommodation(val: any)           { return this.http.post<any>(`${this.API}/accommodations/`, val); }
  updateAccommodation(val: any)        { return this.http.put<any>(`${this.API}/accommodations/`, val); }
  assignAccommodation(employeeId: number, accommodationId: number | null, accommodationRoomId: number | null = null) {
    return this.http.post<any>(`${this.API}/accommodations/assign/`, {
      employee_id: employeeId,
      accommodation_id: accommodationId,
      accommodation_room_id: accommodationRoomId,
    });
  }

  // --- Cereri de concediu ---
  getLeaveRequests()                   { return this.http.get<any>(`${this.API}/leave-requests/`); }
  decideLeaveRequest(requestId: number, action: 'approve' | 'reject') {
    return this.http.post<any>(`${this.API}/leave-requests/${requestId}/decision/`, { action });
  }
  markLeaveRange(employeeId: number, startDate: string, endDate: string, leaveType: 'CO' | 'CM' | 'UNPAID' | 'INDIA') {
    return this.http.post<any>(`${this.API}/leave/mark-range/`, {
      user_id: employeeId,
      start_date: startDate,
      end_date: endDate,
      leave_type: leaveType,
    });
  }

  // --- Documente angajați ---
  getEmployeeDocumentTypes()           { return this.http.get<any>(`${this.API}/employee-document-types/`); }
  addEmployeeDocumentType(val: any)    { return this.http.post<any>(`${this.API}/employee-document-types/`, val); }
  getEmployeeDocuments(employeeId: number) { return this.http.get<any>(`${this.API}/employees/${employeeId}/documents/`); }
  uploadEmployeeDocument(employeeId: number, formData: FormData) {
    return this.http.post<any>(`${this.API}/employees/${employeeId}/documents/`, formData);
  }
  deleteEmployeeDocument(documentId: number) { return this.http.delete<any>(`${this.API}/employee-documents/${documentId}/`); }

  // --- Unelte ---
  getTolList(params?: Record<string, string | number | boolean | null | undefined>): Observable<any[]> {
    const options = params ? { params: this.cleanParams(params) } : {};
    return this.http.get<any[]>(`${this.API}/tool/`, options);
  }
  getTool(id: number | string)         { return this.http.get<any>(`${this.API}/tool/${id}`); }
  getEmployeeTools(userId: number | string, isSsm?: boolean): Observable<any[]> {
    const params: Record<string, string | number | boolean> = { user_id: userId };
    if (isSsm !== undefined) {
      params['is_ssm'] = isSsm;
    }
    return this.getTolList(params);
  }
  addTool(val: any)                    { return this.http.post(`${this.API}/tool/`, val); }
  updateTool(val: any)                 { return this.http.put(`${this.API}/tool/`, val); }
  deleteTool(id: any)                  { return this.http.delete(`${this.API}/tool/${id}`); }
  assignToolQuantity(val: any)         { return this.http.post(`${this.API}/tools/assign-quantity/`, val); }
  returnToolQuantity(val: any)         { return this.http.post(`${this.API}/tools/return-quantity/`, val); }
  getStorekeepers()                    { return this.http.get<any>(`${this.API}/warehouse/storekeepers/`); }
  addStorekeeper(employeeId: number)   { return this.http.post<any>(`${this.API}/warehouse/storekeepers/`, { employee_id: employeeId }); }
  removeStorekeeper(employeeId: number) {
    return this.http.delete<any>(`${this.API}/warehouse/storekeepers/`, { body: { employee_id: employeeId } });
  }

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
  getAttendanceAlerts(date?: string) {
    return this.http.get<any>(`${this.API}/attendance-alerts/`, { params: date ? { date } : {} });
  }
  updateAttendanceAlertConfigs(configs: any[], date?: string) {
    return this.http.put<any>(`${this.API}/attendance-alerts/`, { configs, date });
  }

  manualAttendanceByPin(pin: string, worksiteOrOptions?: string | ManualAttendanceOptions) {
    const options: ManualAttendanceOptions = typeof worksiteOrOptions === 'string'
      ? { worksite: worksiteOrOptions }
      : (worksiteOrOptions ?? {});

    const body: any = {
      uid: 'MANUAL',
      tag_type: 'manual',
      content: pin,
      timestamp: new Date().toISOString(),
      device_key: this.getManualAttendanceDeviceKey(),
      mode: options.mode ?? 'manual',
    };

    if (options.worksite) {
      body.worksite = options.worksite;
    }

    if (options.gps) {
      body.gps = {
        lat: options.gps.lat,
        lng: options.gps.lng,
        accuracy: options.gps.accuracy ?? null,
        captured_at: options.gps.capturedAt ?? null,
      };
    }

    body.data_processing_consent = options.dataProcessingConsent === true;
    if (options.attendancePhoto) {
      body.attendance_photo = options.attendancePhoto;
    }

    return this.http.post<any>(`${this.API}/pontaj/clock/`, {
      pin: body.content,
      device_key: body.device_key,
      timestamp: body.timestamp,
      worksite: body.worksite,
      gps: body.gps,
      mode: body.mode,
      data_processing_consent: body.data_processing_consent,
      attendance_photo: body.attendance_photo,
    });
  }

  teamPortalAttendance(options: ManualAttendanceOptions) {
    return this.http.post<any>(`${this.API}/team-portal/attendance/`, {
      timestamp: new Date().toISOString(),
      worksite: options.worksite,
      gps: options.gps ? {
        lat: options.gps.lat,
        lng: options.gps.lng,
        accuracy: options.gps.accuracy ?? null,
        captured_at: options.gps.capturedAt ?? null,
      } : null,
      data_processing_consent: options.dataProcessingConsent === true,
      attendance_photo: options.attendancePhoto || null,
    });
  }

  getTeamPortalNotificationSummary() {
    return this.http.get<{ unread_count: number }>(`${this.API}/team-portal/notifications/summary/`);
  }

  private getManualAttendanceDeviceKey(): string {
    if (typeof window === 'undefined') {
      return 'server-side-manual-device';
    }

    const existing = window.localStorage.getItem(this.manualDeviceStorageKey);
    if (existing) {
      return existing;
    }

    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

    window.localStorage.setItem(this.manualDeviceStorageKey, generated);
    return generated;
  }

  private cleanParams(params: Record<string, string | number | boolean | null | undefined>): Record<string, string | number | boolean> {
    return Object.entries(params).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string | number | boolean>);
  }

  getAttendancePresent()               { return this.http.get(`${this.API}/pontaj/present/`); }
  getAttendanceWorksites() {
    return this.http.get<{ worksites: string[] }>(`${this.API}/pontaj/worksites/`);
  }
  getAttendanceRange(start: string, end: string) {
    return this.http.get(`${this.API}/pontaj/range/`, { params: { start, end } });
  }
getAttendanceRangeForUser(start: string, end: string, userId: number) {
  // era this.http.get(`${this.API}/pontaj/range/`, ...)
  return this.http.get<any>(`${this.API}/pontaj/range/`, { params: { start, end, user_id: userId } });
}
  getAttendanceWorksiteReport(start: string, end: string, company?: string | null, worksite?: string | null) {
    const params: any = { start, end };
    if (company) {
      params.company = company;
    }
    if (worksite) {
      params.worksite = worksite;
    }
    return this.http.get<any>(`${this.API}/pontaj/reports/worksites/`, { params });
  }
  getAttendanceReportOptions() {
    return this.http.get<any>(`${this.API}/pontaj/reports/options/`);
  }
  getAttendanceCostReport(start: string, end: string, company?: string | null, worksite?: string | null) {
    return this.http.get<any>(`${this.API}/pontaj/reports/costs/`, {
      params: this.cleanParams({ start, end, company, worksite }),
    });
  }
  getAttendanceAbsenceReport(start: string, end: string, company?: string | null, worksite?: string | null) {
    return this.http.get<any>(`${this.API}/pontaj/reports/absences/`, {
      params: this.cleanParams({ start, end, company, worksite }),
    });
  }
  getAttendanceIncompleteReport(start: string, end: string, company?: string | null, worksite?: string | null) {
    return this.http.get<any>(`${this.API}/pontaj/reports/incomplete/`, {
      params: this.cleanParams({ start, end, company, worksite }),
    });
  }
  getAttendanceDayCostReport(date: string, company?: string | null) {
    const params: any = { date };
    if (company) {
      params.company = company;
    }
    return this.http.get<any>(`${this.API}/pontaj/reports/day-cost/`, { params });
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
