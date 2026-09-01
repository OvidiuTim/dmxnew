import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin, of } from 'rxjs';

import { AuthService } from '../auth/auth.service';

type PortalLanguage = 'ro' | 'en' | 'pa' | 'hi' | 'ne';
type PortalView = 'home' | 'salary' | 'team' | 'notifications' | 'missing' | 'absent' | 'leave' | 'supervised' | 'requests' | 'leaveApprovals' | 'transferApprovals' | 'personnel';
interface PortalCopy {
  dashboard: string; welcome: string; language: string; attendance: string; employeeFile: string;
  myTeam: string; notifications: string; clockHint: string; salaryHint: string; teamHint: string;
  notificationHint: string; back: string; totalSalary: string; advance: string; settlement: string;
  lei: string; present: string; absent: string; leave: string; phone: string; call: string;
  noPhone: string; noMembers: string; noNotifications: string; checkedAt: string; markRead: string;
  read: string; unread: string; signOut: string; loading: string; retry: string; error: string; roles: string;
  markAbsent: string; markedAbsent: string; notRequired: string; confirmAbsent: string; markingAbsent: string; absentSaved: string;
  seeMissing: string; seeMissingHint: string; absentToday: string; absentTodayHint: string; teamLabel: string;
  leaderLabel: string; leaderPhone: string; noMissing: string; noAbsent: string; lockedInfo: string;
  markedBy: string; markedAt: string; callLeader: string; checkedInLater: string; teamLeaderRole: string; noTeam: string;
  availableFrom: string; peopleLabel: string;
  leaveRequest: string; leaveHint: string; remainingLeave: string; mealVouchers: string; assignedTools: string; noTools: string;
  leaveType: string; paidLeave: string; unpaidLeave: string; startDate: string; endDate: string; reason: string; sendRequest: string; requestSent: string; history: string;
  supervisedTeams: string; supervisedHint: string; requests: string; requestsHint: string; personnel: string; personnelHint: string;
  addMember: string; search: string; noPersonnel: string; noRequests: string; approve: string; reject: string; sourceTeam: string; destinationTeam: string; requester: string; selectEmployee: string; cancel: string;
  supervisorRole: string; transferRequest: string; requestPending: string; requestApproved: string; requestRejected: string; requestCancelled: string;
  scheduledAbsent: string; absentByLevel1: string; absentByLeader: string; absentBySupervisor: string;
  leaveRequests: string; transferRequests: string; leaveRequestsHint: string; transferRequestsHint: string;
  noLeaveRequests: string; noTransferRequests: string; daysLabel: string; submittedAt: string; currentTeam: string;
  approvalsReceived: string; approvalsMissing: string; reasonOptional: string; openRequest: string;
  newLeaveNotification: string; newTransferNotification: string; leaveResultNotification: string; transferResultNotification: string;
}

@Component({
  selector: 'app-team-portal',
  templateUrl: './team-portal.component.html',
  styleUrls: ['./team-portal.component.css'],
})
export class TeamPortalComponent implements OnInit, OnDestroy {
  private readonly api = `${window.location.origin}/api/team-portal`;
  readonly languages: Array<{ code: PortalLanguage; label: string }> = [
    { code: 'ro', label: 'Română' },
    { code: 'en', label: 'English' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'ne', label: 'नेपाली' },
  ];
  readonly copy: Record<PortalLanguage, PortalCopy> = {
    ro: {
      dashboard: 'Dashboard echipă', welcome: 'Bine ai venit', language: 'Limbă', attendance: 'Pontaj', employeeFile: 'Fișa angajatului',
      myTeam: 'Echipa mea', notifications: 'Notificări', clockHint: 'Fă check-in sau check-out pentru contul tău', salaryHint: 'Vezi sumarul salariului tău',
      teamHint: 'Vezi numai echipele pe care le coordonezi', notificationHint: 'Alertele disponibile pentru rolul tău', back: 'Înapoi',
      totalSalary: 'Salariu total', advance: 'Avans', settlement: 'Lichidare', lei: 'lei', present: 'Pontat', absent: 'Nepontat',
      leave: 'În concediu', phone: 'Număr de telefon', call: 'Sună', noPhone: 'Fără număr de telefon', noMembers: 'Nu există membri.',
      noNotifications: 'Nu există notificări de pontaj.', checkedAt: 'Verificat la', markRead: 'Marchează citită', read: 'Citită', unread: 'Necitită',
      signOut: 'Deconectare', loading: 'Se încarcă…', retry: 'Reîncearcă', error: 'Informațiile nu au putut fi încărcate.', roles: 'Șef de echipă / Supervisor',
      markAbsent: 'Marchează absent', markedAbsent: 'Marcat absent', notRequired: 'Nu se pontează', confirmAbsent: 'Confirmi marcarea ca absent pentru {name} astăzi?', markingAbsent: 'Se salvează…', absentSaved: 'Absența a fost salvată.',
      seeMissing: 'Vezi nepontați', seeMissingHint: 'Toți angajații companiei care nu s-au pontat astăzi', absentToday: 'Lipsă azi', absentTodayHint: 'Absenții zilei, la nivel de companie', teamLabel: 'Echipă',
      leaderLabel: 'Șef de echipă', leaderPhone: 'Telefon șef', noMissing: 'Toți angajații s-au pontat astăzi.', noAbsent: 'Nu există absenți astăzi.', lockedInfo: 'După ora {time} absențele sunt trecute automat și nu mai pot fi modificate.',
      markedBy: 'Marcat de', markedAt: 'Marcat la', callLeader: 'Sună șeful de echipă', checkedInLater: 'S-a pontat ulterior', teamLeaderRole: 'Șef de echipă', noTeam: 'Fără echipă', availableFrom: 'Lista devine disponibilă la {time}.', peopleLabel: 'persoane',
      leaveRequest: 'Cerere concediu', leaveHint: 'Trimite și urmărește cererile tale', remainingLeave: 'Zile de concediu rămase', mealVouchers: 'Bonuri de masă', assignedTools: 'Unelte atribuite', noTools: 'Nu ai unelte atribuite.',
      leaveType: 'Tip concediu', paidLeave: 'Concediu de odihnă', unpaidLeave: 'Concediu fără plată', startDate: 'Data de început', endDate: 'Data de sfârșit', reason: 'Motiv / observații', sendRequest: 'Trimite cererea', requestSent: 'Cererea a fost trimisă.', history: 'Istoric cereri',
      supervisedTeams: 'Echipele mele', supervisedHint: 'Echipele pe care le supervizezi', requests: 'Cereri', requestsHint: 'Concedii și transferuri de soluționat', personnel: 'Personal', personnelHint: 'Caută și solicită angajați',
      addMember: 'Adaugă membru', search: 'Caută după nume, serie, firmă sau echipă', noPersonnel: 'Nu există angajați.', noRequests: 'Nu există cereri.', approve: 'Aprobă', reject: 'Respinge', sourceTeam: 'Echipă sursă', destinationTeam: 'Echipă destinație', requester: 'Solicitant', selectEmployee: 'Selectează angajatul', cancel: 'Renunță',
      supervisorRole: 'Supervisor', transferRequest: 'Cerere de transfer', requestPending: 'În așteptare', requestApproved: 'Aprobată', requestRejected: 'Respinsă', requestCancelled: 'Anulată', scheduledAbsent: 'Nepontat până la 08:10', absentByLevel1: 'Marcat lipsă de Nivel 1', absentByLeader: 'Marcat lipsă de Șef echipă', absentBySupervisor: 'Marcat lipsă de Supervisor',
      leaveRequests: 'Cereri de concediu', transferRequests: 'Cereri de transfer', leaveRequestsHint: 'Concediile pe care le poți soluționa', transferRequestsHint: 'Mutările între echipe care necesită decizia ta', noLeaveRequests: 'Nu există cereri de concediu.', noTransferRequests: 'Nu există cereri de transfer.', daysLabel: 'Număr de zile', submittedAt: 'Trimisă la', currentTeam: 'Echipa actuală', approvalsReceived: 'Aprobări primite', approvalsMissing: 'Aprobări lipsă', reasonOptional: 'Motiv', openRequest: 'Deschide cererea', newLeaveNotification: 'Cerere nouă de concediu', newTransferNotification: 'Cerere nouă de transfer', leaveResultNotification: 'Rezultat cerere de concediu', transferResultNotification: 'Rezultat cerere de transfer',
    },
    en: {
      dashboard: 'Team dashboard', welcome: 'Welcome', language: 'Language', attendance: 'Attendance', employeeFile: 'Employee file',
      myTeam: 'My team', notifications: 'Notifications', clockHint: 'Clock in or out for your own account', salaryHint: 'View your salary summary',
      teamHint: 'See only the teams you coordinate', notificationHint: 'Alerts available for your role', back: 'Back',
      totalSalary: 'Total salary', advance: 'Advance', settlement: 'Settlement', lei: 'lei', present: 'Clocked in', absent: 'Not clocked in',
      leave: 'On leave', phone: 'Phone number', call: 'Call', noPhone: 'No phone number', noMembers: 'No members found.',
      noNotifications: 'No attendance notifications.', checkedAt: 'Checked at', markRead: 'Mark as read', read: 'Read', unread: 'Unread',
      signOut: 'Sign out', loading: 'Loading…', retry: 'Retry', error: 'The information could not be loaded.', roles: 'Team leader / Supervisor',
      markAbsent: 'Mark absent', markedAbsent: 'Marked absent', notRequired: 'Attendance not required', confirmAbsent: 'Mark {name} absent for today?', markingAbsent: 'Saving…', absentSaved: 'The absence was saved.',
      seeMissing: 'See not clocked in', seeMissingHint: 'Every company employee without attendance today', absentToday: 'Absent today', absentTodayHint: "Today's absences, company-wide", teamLabel: 'Team',
      leaderLabel: 'Team leader', leaderPhone: 'Leader phone', noMissing: 'Everyone clocked in today.', noAbsent: 'No absences today.', lockedInfo: 'After {time} absences are recorded automatically and can no longer be changed.',
      markedBy: 'Marked by', markedAt: 'Marked at', callLeader: 'Call the team leader', checkedInLater: 'Clocked in later', teamLeaderRole: 'Team leader', noTeam: 'No team', availableFrom: 'The list becomes available at {time}.', peopleLabel: 'people',
      leaveRequest: 'Leave request', leaveHint: 'Send and track your requests', remainingLeave: 'Remaining leave days', mealVouchers: 'Meal vouchers', assignedTools: 'Assigned tools', noTools: 'No tools assigned.',
      leaveType: 'Leave type', paidLeave: 'Paid leave', unpaidLeave: 'Unpaid leave', startDate: 'Start date', endDate: 'End date', reason: 'Reason / notes', sendRequest: 'Send request', requestSent: 'The request was sent.', history: 'Request history',
      supervisedTeams: 'My supervised teams', supervisedHint: 'Teams you supervise', requests: 'Requests', requestsHint: 'Leave and transfer approvals', personnel: 'Personnel', personnelHint: 'Search and request employees',
      addMember: 'Add member', search: 'Search by name, series, company or team', noPersonnel: 'No employees found.', noRequests: 'No requests found.', approve: 'Approve', reject: 'Reject', sourceTeam: 'Source team', destinationTeam: 'Destination team', requester: 'Requester', selectEmployee: 'Select employee', cancel: 'Cancel',
      supervisorRole: 'Supervisor', transferRequest: 'Transfer request', requestPending: 'Pending', requestApproved: 'Approved', requestRejected: 'Rejected', requestCancelled: 'Cancelled', scheduledAbsent: 'Not clocked in by 08:10', absentByLevel1: 'Marked absent by Level 1', absentByLeader: 'Marked absent by team leader', absentBySupervisor: 'Marked absent by supervisor',
      leaveRequests: 'Leave requests', transferRequests: 'Transfer requests', leaveRequestsHint: 'Leave requests you can decide', transferRequestsHint: 'Team transfers that require your decision', noLeaveRequests: 'No leave requests.', noTransferRequests: 'No transfer requests.', daysLabel: 'Number of days', submittedAt: 'Submitted at', currentTeam: 'Current team', approvalsReceived: 'Approvals received', approvalsMissing: 'Approvals missing', reasonOptional: 'Reason', openRequest: 'Open request', newLeaveNotification: 'New leave request', newTransferNotification: 'New transfer request', leaveResultNotification: 'Leave request result', transferResultNotification: 'Transfer request result',
    },
    pa: {
      dashboard: 'ਟੀਮ ਡੈਸ਼ਬੋਰਡ', welcome: 'ਜੀ ਆਇਆਂ ਨੂੰ', language: 'ਭਾਸ਼ਾ', attendance: 'ਹਾਜ਼ਰੀ', employeeFile: 'ਕਰਮਚਾਰੀ ਵੇਰਵਾ',
      myTeam: 'ਮੇਰੀ ਟੀਮ', notifications: 'ਸੂਚਨਾਵਾਂ', clockHint: 'ਆਪਣੇ ਖਾਤੇ ਲਈ ਚੈਕ ਇਨ ਜਾਂ ਚੈਕ ਆਉਟ ਕਰੋ', salaryHint: 'ਆਪਣੀ ਤਨਖਾਹ ਦਾ ਸਾਰ ਵੇਖੋ',
      teamHint: 'ਸਿਰਫ਼ ਆਪਣੀਆਂ ਟੀਮਾਂ ਵੇਖੋ', notificationHint: 'ਤੁਹਾਡੀ ਭੂਮਿਕਾ ਲਈ ਉਪਲਬਧ ਸੂਚਨਾਵਾਂ', back: 'ਵਾਪਸ',
      totalSalary: 'ਕੁੱਲ ਤਨਖਾਹ', advance: 'ਅਡਵਾਂਸ', settlement: 'ਬਾਕੀ ਭੁਗਤਾਨ', lei: 'ਲੇਈ', present: 'ਹਾਜ਼ਰ', absent: 'ਹਾਜ਼ਰੀ ਨਹੀਂ',
      leave: 'ਛੁੱਟੀ ਤੇ', phone: 'ਫੋਨ ਨੰਬਰ', call: 'ਕਾਲ ਕਰੋ', noPhone: 'ਫੋਨ ਨੰਬਰ ਨਹੀਂ', noMembers: 'ਕੋਈ ਮੈਂਬਰ ਨਹੀਂ ਮਿਲਿਆ।',
      noNotifications: 'ਕੋਈ ਹਾਜ਼ਰੀ ਸੂਚਨਾ ਨਹੀਂ।', checkedAt: 'ਜਾਂਚ ਦਾ ਸਮਾਂ', markRead: 'ਪੜ੍ਹਿਆ ਨਿਸ਼ਾਨ ਲਗਾਓ', read: 'ਪੜ੍ਹਿਆ', unread: 'ਨਵੀਂ',
      signOut: 'ਲਾਗ ਆਉਟ', loading: 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…', retry: 'ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼', error: 'ਜਾਣਕਾਰੀ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ।', roles: 'ਟੀਮ ਲੀਡਰ / ਸੁਪਰਵਾਈਜ਼ਰ',
      markAbsent: 'ਗੈਰਹਾਜ਼ਰ ਨਿਸ਼ਾਨ ਲਗਾਓ', markedAbsent: 'ਗੈਰਹਾਜ਼ਰ', notRequired: 'ਹਾਜ਼ਰੀ ਲਾਜ਼ਮੀ ਨਹੀਂ', confirmAbsent: 'ਕੀ {name} ਨੂੰ ਅੱਜ ਗੈਰਹਾਜ਼ਰ ਨਿਸ਼ਾਨ ਲਗਾਉਣਾ ਹੈ?', markingAbsent: 'ਸੇਵ ਹੋ ਰਿਹਾ ਹੈ…', absentSaved: 'ਗੈਰਹਾਜ਼ਰੀ ਸੇਵ ਹੋ ਗਈ।',
      seeMissing: 'ਹਾਜ਼ਰੀ ਨਾ ਲਗਾਉਣ ਵਾਲੇ ਵੇਖੋ', seeMissingHint: 'ਕੰਪਨੀ ਦੇ ਸਾਰੇ ਕਰਮਚਾਰੀ ਜਿਨ੍ਹਾਂ ਨੇ ਅੱਜ ਹਾਜ਼ਰੀ ਨਹੀਂ ਲਗਾਈ', absentToday: 'ਅੱਜ ਦੀ ਗੈਰਹਾਜ਼ਰੀ', absentTodayHint: 'ਪੂਰੀ ਕੰਪਨੀ ਦੀ ਅੱਜ ਦੀ ਗੈਰਹਾਜ਼ਰੀ', teamLabel: 'ਟੀਮ',
      leaderLabel: 'ਟੀਮ ਲੀਡਰ', leaderPhone: 'ਲੀਡਰ ਦਾ ਫੋਨ', noMissing: 'ਅੱਜ ਸਾਰਿਆਂ ਨੇ ਹਾਜ਼ਰੀ ਲਗਾਈ।', noAbsent: 'ਅੱਜ ਕੋਈ ਗੈਰਹਾਜ਼ਰ ਨਹੀਂ।', lockedInfo: '{time} ਤੋਂ ਬਾਅਦ ਗੈਰਹਾਜ਼ਰੀ ਆਪਣੇ ਆਪ ਦਰਜ ਹੁੰਦੀ ਹੈ ਅਤੇ ਬਦਲੀ ਨਹੀਂ ਜਾ ਸਕਦੀ।',
      markedBy: 'ਨਿਸ਼ਾਨ ਲਗਾਉਣ ਵਾਲਾ', markedAt: 'ਸਮਾਂ', callLeader: 'ਟੀਮ ਲੀਡਰ ਨੂੰ ਕਾਲ ਕਰੋ', checkedInLater: 'ਬਾਅਦ ਵਿੱਚ ਹਾਜ਼ਰੀ ਲਗਾਈ', teamLeaderRole: 'ਟੀਮ ਲੀਡਰ', noTeam: 'ਟੀਮ ਨਹੀਂ', availableFrom: '{time} ਵਜੇ ਤੋਂ ਸੂਚੀ ਉਪਲਬਧ ਹੋਵੇਗੀ।', peopleLabel: 'ਵਿਅਕਤੀ',
      leaveRequest: 'ਛੁੱਟੀ ਦੀ ਬੇਨਤੀ', leaveHint: 'ਆਪਣੀਆਂ ਬੇਨਤੀਆਂ ਭੇਜੋ ਅਤੇ ਵੇਖੋ', remainingLeave: 'ਬਾਕੀ ਛੁੱਟੀ ਦੇ ਦਿਨ', mealVouchers: 'ਖਾਣੇ ਦੇ ਵਾਊਚਰ', assignedTools: 'ਦਿੱਤੇ ਗਏ ਸੰਦ', noTools: 'ਕੋਈ ਸੰਦ ਨਹੀਂ ਦਿੱਤਾ ਗਿਆ।',
      leaveType: 'ਛੁੱਟੀ ਦੀ ਕਿਸਮ', paidLeave: 'ਤਨਖਾਹ ਸਮੇਤ ਛੁੱਟੀ', unpaidLeave: 'ਬਿਨਾਂ ਤਨਖਾਹ ਛੁੱਟੀ', startDate: 'ਸ਼ੁਰੂ ਮਿਤੀ', endDate: 'ਅੰਤ ਮਿਤੀ', reason: 'ਕਾਰਨ / ਨੋਟ', sendRequest: 'ਬੇਨਤੀ ਭੇਜੋ', requestSent: 'ਬੇਨਤੀ ਭੇਜੀ ਗਈ।', history: 'ਬੇਨਤੀਆਂ ਦਾ ਇਤਿਹਾਸ',
      supervisedTeams: 'ਮੇਰੀਆਂ ਟੀਮਾਂ', supervisedHint: 'ਤੁਹਾਡੇ ਅਧੀਨ ਟੀਮਾਂ', requests: 'ਬੇਨਤੀਆਂ', requestsHint: 'ਛੁੱਟੀ ਅਤੇ ਤਬਾਦਲੇ ਦੀ ਮਨਜ਼ੂਰੀ', personnel: 'ਕਰਮਚਾਰੀ', personnelHint: 'ਕਰਮਚਾਰੀ ਲੱਭੋ ਅਤੇ ਬੇਨਤੀ ਕਰੋ',
      addMember: 'ਮੈਂਬਰ ਸ਼ਾਮਲ ਕਰੋ', search: 'ਨਾਮ, ਸੀਰੀਜ਼, ਕੰਪਨੀ ਜਾਂ ਟੀਮ ਨਾਲ ਲੱਭੋ', noPersonnel: 'ਕੋਈ ਕਰਮਚਾਰੀ ਨਹੀਂ।', noRequests: 'ਕੋਈ ਬੇਨਤੀ ਨਹੀਂ।', approve: 'ਮਨਜ਼ੂਰ', reject: 'ਰੱਦ', sourceTeam: 'ਮੂਲ ਟੀਮ', destinationTeam: 'ਮੰਜ਼ਿਲ ਟੀਮ', requester: 'ਬੇਨਤੀਕਰਤਾ', selectEmployee: 'ਕਰਮਚਾਰੀ ਚੁਣੋ', cancel: 'ਰੱਦ ਕਰੋ',
      supervisorRole: 'ਸੁਪਰਵਾਈਜ਼ਰ', transferRequest: 'ਤਬਾਦਲੇ ਦੀ ਬੇਨਤੀ', requestPending: 'ਬਕਾਇਆ', requestApproved: 'ਮਨਜ਼ੂਰ', requestRejected: 'ਰੱਦ', requestCancelled: 'ਰੱਦ ਕੀਤੀ', scheduledAbsent: '08:10 ਤੱਕ ਹਾਜ਼ਰੀ ਨਹੀਂ', absentByLevel1: 'ਲੈਵਲ 1 ਵੱਲੋਂ ਗੈਰਹਾਜ਼ਰ', absentByLeader: 'ਟੀਮ ਲੀਡਰ ਵੱਲੋਂ ਗੈਰਹਾਜ਼ਰ', absentBySupervisor: 'ਸੁਪਰਵਾਈਜ਼ਰ ਵੱਲੋਂ ਗੈਰਹਾਜ਼ਰ',
      leaveRequests: 'ਛੁੱਟੀ ਦੀਆਂ ਬੇਨਤੀਆਂ', transferRequests: 'ਤਬਾਦਲੇ ਦੀਆਂ ਬੇਨਤੀਆਂ', leaveRequestsHint: 'ਛੁੱਟੀਆਂ ਜਿਨ੍ਹਾਂ ਦਾ ਤੁਸੀਂ ਫੈਸਲਾ ਕਰ ਸਕਦੇ ਹੋ', transferRequestsHint: 'ਟੀਮ ਤਬਾਦਲੇ ਜਿਨ੍ਹਾਂ ਲਈ ਤੁਹਾਡਾ ਫੈਸਲਾ ਚਾਹੀਦਾ ਹੈ', noLeaveRequests: 'ਕੋਈ ਛੁੱਟੀ ਦੀ ਬੇਨਤੀ ਨਹੀਂ।', noTransferRequests: 'ਕੋਈ ਤਬਾਦਲੇ ਦੀ ਬੇਨਤੀ ਨਹੀਂ।', daysLabel: 'ਦਿਨਾਂ ਦੀ ਗਿਣਤੀ', submittedAt: 'ਭੇਜਣ ਦਾ ਸਮਾਂ', currentTeam: 'ਮੌਜੂਦਾ ਟੀਮ', approvalsReceived: 'ਮਿਲੀਆਂ ਮਨਜ਼ੂਰੀਆਂ', approvalsMissing: 'ਬਾਕੀ ਮਨਜ਼ੂਰੀਆਂ', reasonOptional: 'ਕਾਰਨ', openRequest: 'ਬੇਨਤੀ ਖੋਲ੍ਹੋ', newLeaveNotification: 'ਨਵੀਂ ਛੁੱਟੀ ਦੀ ਬੇਨਤੀ', newTransferNotification: 'ਨਵੀਂ ਤਬਾਦਲੇ ਦੀ ਬੇਨਤੀ', leaveResultNotification: 'ਛੁੱਟੀ ਦੀ ਬੇਨਤੀ ਦਾ ਨਤੀਜਾ', transferResultNotification: 'ਤਬਾਦਲੇ ਦੀ ਬੇਨਤੀ ਦਾ ਨਤੀਜਾ',
    },
    hi: {
      dashboard: 'टीम डैशबोर्ड', welcome: 'स्वागत है', language: 'भाषा', attendance: 'उपस्थिति', employeeFile: 'कर्मचारी विवरण',
      myTeam: 'मेरी टीम', notifications: 'सूचनाएं', clockHint: 'अपने खाते के लिए चेक इन या चेक आउट करें', salaryHint: 'अपना वेतन सार देखें',
      teamHint: 'केवल अपनी टीम देखें', notificationHint: 'आपकी भूमिका के लिए उपलब्ध सूचनाएं', back: 'वापस',
      totalSalary: 'कुल वेतन', advance: 'अग्रिम', settlement: 'शेष भुगतान', lei: 'लेई', present: 'उपस्थित', absent: 'उपस्थित नहीं',
      leave: 'छुट्टी पर', phone: 'फोन नंबर', call: 'कॉल करें', noPhone: 'फोन नंबर नहीं', noMembers: 'कोई सदस्य नहीं मिला।',
      noNotifications: 'कोई उपस्थिति सूचना नहीं।', checkedAt: 'जांच का समय', markRead: 'पढ़ा हुआ करें', read: 'पढ़ा हुआ', unread: 'नई',
      signOut: 'लॉग आउट', loading: 'लोड हो रहा है…', retry: 'फिर प्रयास करें', error: 'जानकारी लोड नहीं हो सकी।', roles: 'टीम लीडर / सुपरवाइज़र',
      markAbsent: 'अनुपस्थित करें', markedAbsent: 'अनुपस्थित', notRequired: 'उपस्थिति आवश्यक नहीं', confirmAbsent: 'क्या {name} को आज अनुपस्थित चिह्नित करना है?', markingAbsent: 'सहेजा जा रहा है…', absentSaved: 'अनुपस्थिति सहेजी गई।',
      seeMissing: 'उपस्थित न हुए देखें', seeMissingHint: 'कंपनी के सभी कर्मचारी जिन्होंने आज उपस्थिति नहीं लगाई', absentToday: 'आज की अनुपस्थिति', absentTodayHint: 'पूरी कंपनी की आज की अनुपस्थिति', teamLabel: 'टीम',
      leaderLabel: 'टीम लीडर', leaderPhone: 'लीडर का फोन', noMissing: 'आज सभी ने उपस्थिति लगाई।', noAbsent: 'आज कोई अनुपस्थित नहीं।', lockedInfo: '{time} के बाद अनुपस्थिति स्वतः दर्ज होती है और बदली नहीं जा सकती।',
      markedBy: 'चिह्नित किया', markedAt: 'समय', callLeader: 'टीम लीडर को कॉल करें', checkedInLater: 'बाद में उपस्थिति लगाई', teamLeaderRole: 'टीम लीडर', noTeam: 'कोई टीम नहीं', availableFrom: '{time} बजे से सूची उपलब्ध होगी।', peopleLabel: 'व्यक्ति',
      leaveRequest: 'छुट्टी अनुरोध', leaveHint: 'अपने अनुरोध भेजें और देखें', remainingLeave: 'शेष छुट्टी के दिन', mealVouchers: 'भोजन वाउचर', assignedTools: 'दिए गए औज़ार', noTools: 'कोई औज़ार नहीं दिया गया।',
      leaveType: 'छुट्टी का प्रकार', paidLeave: 'सवेतन छुट्टी', unpaidLeave: 'अवैतनिक छुट्टी', startDate: 'आरंभ तिथि', endDate: 'समाप्ति तिथि', reason: 'कारण / टिप्पणी', sendRequest: 'अनुरोध भेजें', requestSent: 'अनुरोध भेज दिया गया।', history: 'अनुरोध इतिहास',
      supervisedTeams: 'मेरी टीमें', supervisedHint: 'आपके पर्यवेक्षण की टीमें', requests: 'अनुरोध', requestsHint: 'छुट्टी और स्थानांतरण अनुमोदन', personnel: 'कर्मचारी', personnelHint: 'कर्मचारी खोजें और अनुरोध करें',
      addMember: 'सदस्य जोड़ें', search: 'नाम, सीरीज़, कंपनी या टीम से खोजें', noPersonnel: 'कोई कर्मचारी नहीं मिला।', noRequests: 'कोई अनुरोध नहीं।', approve: 'स्वीकार करें', reject: 'अस्वीकार करें', sourceTeam: 'स्रोत टीम', destinationTeam: 'गंतव्य टीम', requester: 'अनुरोधकर्ता', selectEmployee: 'कर्मचारी चुनें', cancel: 'रद्द करें',
      supervisorRole: 'सुपरवाइज़र', transferRequest: 'स्थानांतरण अनुरोध', requestPending: 'प्रतीक्षारत', requestApproved: 'स्वीकृत', requestRejected: 'अस्वीकृत', requestCancelled: 'रद्द', scheduledAbsent: '08:10 तक उपस्थिति नहीं', absentByLevel1: 'लेवल 1 द्वारा अनुपस्थित', absentByLeader: 'टीम लीडर द्वारा अनुपस्थित', absentBySupervisor: 'सुपरवाइज़र द्वारा अनुपस्थित',
      leaveRequests: 'छुट्टी के अनुरोध', transferRequests: 'स्थानांतरण अनुरोध', leaveRequestsHint: 'वे छुट्टी अनुरोध जिन पर आप निर्णय ले सकते हैं', transferRequestsHint: 'टीम स्थानांतरण जिनमें आपका निर्णय आवश्यक है', noLeaveRequests: 'कोई छुट्टी अनुरोध नहीं।', noTransferRequests: 'कोई स्थानांतरण अनुरोध नहीं।', daysLabel: 'दिनों की संख्या', submittedAt: 'भेजने का समय', currentTeam: 'वर्तमान टीम', approvalsReceived: 'मिली स्वीकृतियां', approvalsMissing: 'बाकी स्वीकृतियां', reasonOptional: 'कारण', openRequest: 'अनुरोध खोलें', newLeaveNotification: 'नया छुट्टी अनुरोध', newTransferNotification: 'नया स्थानांतरण अनुरोध', leaveResultNotification: 'छुट्टी अनुरोध का परिणाम', transferResultNotification: 'स्थानांतरण अनुरोध का परिणाम',
    },
    ne: {
      dashboard: 'टोली ड्यासबोर्ड', welcome: 'स्वागत छ', language: 'भाषा', attendance: 'हाजिरी', employeeFile: 'कर्मचारी विवरण',
      myTeam: 'मेरो टोली', notifications: 'सूचनाहरू', clockHint: 'आफ्नो खाताको चेक इन वा चेक आउट गर्नुहोस्', salaryHint: 'आफ्नो तलब सारांश हेर्नुहोस्',
      teamHint: 'आफूले समन्वय गर्ने टोली मात्र हेर्नुहोस्', notificationHint: 'तपाईंको भूमिकाका लागि उपलब्ध सूचनाहरू', back: 'पछाडि',
      totalSalary: 'कुल तलब', advance: 'अग्रिम', settlement: 'बाँकी भुक्तानी', lei: 'लेई', present: 'हाजिर', absent: 'हाजिर छैन',
      leave: 'बिदामा', phone: 'फोन नम्बर', call: 'फोन गर्नुहोस्', noPhone: 'फोन नम्बर छैन', noMembers: 'कुनै सदस्य भेटिएन।',
      noNotifications: 'कुनै हाजिरी सूचना छैन।', checkedAt: 'जाँच समय', markRead: 'पढिएको चिन्ह लगाउनुहोस्', read: 'पढिएको', unread: 'नयाँ',
      signOut: 'लग आउट', loading: 'लोड हुँदैछ…', retry: 'फेरि प्रयास', error: 'जानकारी लोड हुन सकेन।', roles: 'टोली प्रमुख / सुपरभाइजर',
      markAbsent: 'अनुपस्थित चिन्ह लगाउनुहोस्', markedAbsent: 'अनुपस्थित', notRequired: 'हाजिरी आवश्यक छैन', confirmAbsent: 'के {name} लाई आज अनुपस्थित चिन्ह लगाउने?', markingAbsent: 'सुरक्षित हुँदैछ…', absentSaved: 'अनुपस्थिति सुरक्षित भयो।',
      seeMissing: 'हाजिर नभएका हेर्नुहोस्', seeMissingHint: 'आज हाजिर नभएका कम्पनीका सबै कर्मचारी', absentToday: 'आजको अनुपस्थिति', absentTodayHint: 'पूरै कम्पनीको आजको अनुपस्थिति', teamLabel: 'टोली',
      leaderLabel: 'टोली प्रमुख', leaderPhone: 'प्रमुखको फोन', noMissing: 'आज सबैले हाजिरी गरे।', noAbsent: 'आज कोही अनुपस्थित छैन।', lockedInfo: '{time} पछि अनुपस्थिति स्वतः दर्ता हुन्छ र परिवर्तन गर्न मिल्दैन।',
      markedBy: 'चिन्ह लगाउने', markedAt: 'समय', callLeader: 'टोली प्रमुखलाई फोन गर्नुहोस्', checkedInLater: 'पछि हाजिर भयो', teamLeaderRole: 'टोली प्रमुख', noTeam: 'टोली छैन', availableFrom: '{time} बजेदेखि सूची उपलब्ध हुनेछ।', peopleLabel: 'व्यक्ति',
      leaveRequest: 'बिदा अनुरोध', leaveHint: 'आफ्ना अनुरोध पठाउनुहोस् र हेर्नुहोस्', remainingLeave: 'बाँकी बिदाका दिन', mealVouchers: 'खाना भौचर', assignedTools: 'दिइएका औजार', noTools: 'कुनै औजार दिइएको छैन।',
      leaveType: 'बिदाको प्रकार', paidLeave: 'तलबसहित बिदा', unpaidLeave: 'बेतलबी बिदा', startDate: 'सुरु मिति', endDate: 'अन्त्य मिति', reason: 'कारण / टिप्पणी', sendRequest: 'अनुरोध पठाउनुहोस्', requestSent: 'अनुरोध पठाइयो।', history: 'अनुरोध इतिहास',
      supervisedTeams: 'मेरा टोलीहरू', supervisedHint: 'तपाईंले सुपरिवेक्षण गर्ने टोलीहरू', requests: 'अनुरोधहरू', requestsHint: 'बिदा र सरुवा स्वीकृति', personnel: 'कर्मचारी', personnelHint: 'कर्मचारी खोज्नुहोस् र अनुरोध गर्नुहोस्',
      addMember: 'सदस्य थप्नुहोस्', search: 'नाम, सिरिज, कम्पनी वा टोलीबाट खोज्नुहोस्', noPersonnel: 'कुनै कर्मचारी छैन।', noRequests: 'कुनै अनुरोध छैन।', approve: 'स्वीकृत', reject: 'अस्वीकृत', sourceTeam: 'स्रोत टोली', destinationTeam: 'गन्तव्य टोली', requester: 'अनुरोधकर्ता', selectEmployee: 'कर्मचारी छान्नुहोस्', cancel: 'रद्द गर्नुहोस्',
      supervisorRole: 'सुपरभाइजर', transferRequest: 'सरुवा अनुरोध', requestPending: 'प्रतीक्षामा', requestApproved: 'स्वीकृत', requestRejected: 'अस्वीकृत', requestCancelled: 'रद्द', scheduledAbsent: '08:10 सम्म हाजिर नभएको', absentByLevel1: 'स्तर 1 ले अनुपस्थित चिन्ह लगाएको', absentByLeader: 'टोली प्रमुखले अनुपस्थित चिन्ह लगाएको', absentBySupervisor: 'सुपरभाइजरले अनुपस्थित चिन्ह लगाएको',
      leaveRequests: 'बिदा अनुरोधहरू', transferRequests: 'सरुवा अनुरोधहरू', leaveRequestsHint: 'तपाईंले निर्णय गर्न सक्ने बिदा अनुरोधहरू', transferRequestsHint: 'तपाईंको निर्णय चाहिने टोली सरुवा', noLeaveRequests: 'कुनै बिदा अनुरोध छैन।', noTransferRequests: 'कुनै सरुवा अनुरोध छैन।', daysLabel: 'दिन संख्या', submittedAt: 'पठाइएको समय', currentTeam: 'हालको टोली', approvalsReceived: 'प्राप्त स्वीकृतिहरू', approvalsMissing: 'बाँकी स्वीकृतिहरू', reasonOptional: 'कारण', openRequest: 'अनुरोध खोल्नुहोस्', newLeaveNotification: 'नयाँ बिदा अनुरोध', newTransferNotification: 'नयाँ सरुवा अनुरोध', leaveResultNotification: 'बिदा अनुरोधको नतिजा', transferResultNotification: 'सरुवा अनुरोधको नतिजा',
    },
  };

  language: PortalLanguage = this.readLanguage();
  view: PortalView = 'home';
  dashboard: any = null;
  salary: any = null;
  teams: any[] = [];
  notifications: any[] = [];
  missing: any = null;
  absentToday: any = null;
  leaveData: any = null;
  supervisedTeams: any[] = [];
  requests: any[] = [];
  requestSummary = { leave_pending_count: 0, transfer_pending_count: 0, pending_count: 0 };
  leaveApprovalRequests: any[] = [];
  transferApprovalRequests: any[] = [];
  personnel: any[] = [];
  personnelTeams: any[] = [];
  personnelSearch = '';
  openTeamId: number | null = null;
  memberPicker: any = null;
  memberCandidates: any[] = [];
  memberSearch = '';
  selectedMemberId: number | null = null;
  submitting = false;
  leaveForm = { leave_type: 'paid_leave', start_date: '', end_date: '', reason: '' };
  teamsLocked = false;
  teamsCanMarkAbsent = false;
  supervisedCanMarkAbsent = false;
  teamsLockTime = '08:10';
  loading = true;
  error = '';
  openMemberId: number | null = null;
  markingAbsentId: number | null = null;
  notice = '';
  private refreshPoll: ReturnType<typeof setInterval> | null = null;
  private handledRefreshes = new Set<string>();
  focusRequestId: number | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
  ) {}

  ngOnInit(): void {
    this.view = (this.route.snapshot.data['portalView'] || 'home') as PortalView;
    this.focusRequestId = Number(this.route.snapshot.queryParamMap.get('request')) || null;
    this.loadCurrentView();
    this.startTimedRefreshPolling();
  }

  ngOnDestroy(): void {
    if (this.refreshPoll) clearInterval(this.refreshPoll);
  }
  get t(): PortalCopy { return this.copy[this.language]; }

  /** Nivel 1 și Nivel 2 văd cardurile globale de lipsă. */
  get isLevel1(): boolean { return !!this.dashboard?.alert_level_1; }
  get isLevel2(): boolean { return !!this.dashboard?.alert_level_2; }

  /** Rolurile afișate în header: „Șef de echipă” apare doar dacă chiar are rolul. */
  get roleLabel(): string {
    if (!this.dashboard) return '';
    const labels: string[] = [];
    if (this.dashboard.is_team_leader) labels.push(this.t.teamLeaderRole);
    const configured = this.dashboard.role_labels || {};
    if (this.dashboard.alert_level_1) labels.push(configured['1'] || 'Nivel 1');
    if (this.dashboard.alert_level_2) labels.push(configured['2'] || 'Nivel 2');
    if (this.dashboard.is_supervisor) labels.push(this.t.supervisorRole);
    return labels.length ? labels.join(' / ') : this.t.dashboard;
  }
  get unreadCount(): number { return this.notifications.filter(item => !item.is_read).length || Number(this.dashboard?.unread_notifications || 0); }

  setLanguage(value: PortalLanguage): void {
    this.language = value;
    localStorage.setItem('team-portal-language', value);
    localStorage.setItem('clockinandout-language', value);
  }

  open(view: PortalView): void {
    const paths: Record<PortalView, string> = {
      home: '/team-dashboard', salary: '/team-dashboard/fisa-angajat', team: '/team-dashboard/echipa-mea',
      notifications: '/team-dashboard/notificari', missing: '/team-dashboard/vezi-lipsa', absent: '/team-dashboard/lipsa-azi',
      leave: '/team-dashboard/cerere-concediu', supervised: '/team-dashboard/echipele-mele', requests: '/team-dashboard/cereri',
      leaveApprovals: '/team-dashboard/cereri-concediu', transferApprovals: '/team-dashboard/cereri-transfer', personnel: '/team-dashboard/personal'
    };
    void this.router.navigateByUrl(paths[view], { state: { teamDashboardOrigin: this.router.url } });
  }

  goBack(): void {
    const origin = window.history.state?.teamDashboardOrigin;
    if (typeof origin === 'string' && origin.startsWith('/team-dashboard') && origin !== this.router.url) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl('/team-dashboard');
  }

  openAttendance(): void {
    void this.router.navigateByUrl('/team-dashboard/pontaj', {
      state: { teamDashboardOrigin: this.router.url },
    });
  }

  loadCurrentView(): void {
    if (this.view === 'home') {
      this.loadHome();
      return;
    }
    this.error = '';
    this.loading = true;
    const endpoints: Record<Exclude<PortalView, 'home'>, string> = {
      salary: 'salary', team: 'teams', notifications: 'notifications', missing: 'missing-today', absent: 'absent-today',
      leave: 'leave-requests', supervised: 'supervised-teams', requests: 'requests/summary',
      leaveApprovals: 'requests/leaves', transferApprovals: 'requests/transfers', personnel: 'personnel',
    };
    // Cardurile globale au nevoie și de dashboard, pentru rolurile din header.
    const needsDashboard = !this.dashboard;
    forkJoin({
      data: this.http.get<any>(`${this.api}/${endpoints[this.view as Exclude<PortalView, 'home'>]}/`),
      dashboard: needsDashboard ? this.http.get<any>(`${this.api}/dashboard/`) : of(this.dashboard),
    }).subscribe({
      next: ({ data, dashboard }) => {
        if (dashboard) this.dashboard = dashboard;
        if (this.view === 'salary') this.salary = data;
        if (this.view === 'team') {
          this.teams = data.teams || [];
          this.teamsLocked = !!data.locked;
          this.teamsLockTime = data.lock_time || this.teamsLockTime;
          this.teamsCanMarkAbsent = !!data.can_mark_absent;
        }
        if (this.view === 'missing') this.missing = data;
        if (this.view === 'absent') this.absentToday = data;
        if (this.view === 'leave') this.leaveData = data;
        if (this.view === 'supervised') {
          this.supervisedTeams = data.teams || [];
          this.supervisedCanMarkAbsent = !!data.can_mark_absent;
        }
        if (this.view === 'requests') this.requestSummary = data;
        if (this.view === 'leaveApprovals') this.leaveApprovalRequests = data.requests || [];
        if (this.view === 'transferApprovals') this.transferApprovalRequests = data.requests || [];
        if (this.view === 'personnel') {
          this.personnel = data.employees || [];
          this.personnelTeams = data.teams || [];
        }
        if (this.view === 'notifications') {
          this.notifications = data.notifications || [];
          if (this.dashboard) this.dashboard.unread_notifications = data.unread_count || 0;
        }
        this.loading = false;
        this.scrollToFocusedRequest();
      },
      error: response => { this.error = this.responseError(response); this.loading = false; },
    });
  }

  loadHome(): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      dashboard: this.http.get<any>(`${this.api}/dashboard/`),
      notifications: this.http.get<any>(`${this.api}/notifications/`),
    }).subscribe({
      next: result => {
        this.dashboard = result.dashboard;
        this.notifications = result.notifications.notifications || [];
        this.loading = false;
      },
      error: () => { this.error = this.t.error; this.loading = false; },
    });
  }

  toggleMember(id: number): void { this.openMemberId = this.openMemberId === id ? null : id; }
  toggleTeam(id: number): void { this.openTeamId = this.openTeamId === id ? null : id; }

  get filteredPersonnel(): any[] {
    const needle = this.normalize(this.personnelSearch);
    if (!needle) return this.personnel;
    return this.personnel.filter(person => this.normalize([
      person.name, person.serie, person.company, person.team?.name,
    ].join(' ')).includes(needle));
  }

  get filteredCandidates(): any[] {
    const needle = this.normalize(this.memberSearch);
    if (!needle) return this.memberCandidates;
    return this.memberCandidates.filter(person => this.normalize([
      person.name, person.serie, person.company, person.team?.name,
    ].join(' ')).includes(needle));
  }

  get personnelGroups(): Array<{ name: string; employees: any[] }> {
    const groups = new Map<string, any[]>();
    for (const person of this.filteredPersonnel) {
      const name = person.team?.name || this.t.noTeam;
      groups.set(name, [...(groups.get(name) || []), person]);
    }
    return Array.from(groups.entries()).map(([name, employees]) => ({ name, employees }));
  }

  startAddMember(team: any): void {
    this.memberPicker = team;
    this.memberCandidates = [];
    this.memberSearch = '';
    this.selectedMemberId = null;
    this.http.get<any>(`${this.api}/member-candidates/?team_id=${team.id}`).subscribe({
      next: data => this.memberCandidates = data.employees || [],
      error: response => this.error = this.responseError(response),
    });
  }

  closeMemberPicker(): void { this.memberPicker = null; this.memberCandidates = []; }

  submitMemberRequest(): void {
    if (!this.memberPicker || !this.selectedMemberId) return;
    this.submitting = true;
    this.http.post<any>(`${this.api}/transfer-requests/`, {
      employee_id: this.selectedMemberId,
      destination_team_id: this.memberPicker.id,
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.closeMemberPicker();
        this.notice = this.t.requestSent;
        this.loadCurrentView();
      },
      error: response => {
        this.submitting = false;
        this.error = this.responseError(response);
      },
    });
  }

  requestPersonnel(person: any): void {
    const destinationTeamId = Number(person.destination_team_id || 0);
    if (!destinationTeamId) return;
    this.submitting = true;
    this.http.post<any>(`${this.api}/transfer-requests/`, {
      employee_id: person.id,
      destination_team_id: destinationTeamId,
    }).subscribe({
      next: () => { this.submitting = false; this.notice = this.t.requestSent; this.loadCurrentView(); },
      error: response => { this.submitting = false; this.error = this.responseError(response); },
    });
  }

  submitLeave(): void {
    if (!this.leaveForm.start_date || !this.leaveForm.end_date) return;
    this.submitting = true;
    this.http.post<any>(`${this.api}/leave-requests/`, this.leaveForm).subscribe({
      next: () => {
        this.submitting = false;
        this.notice = this.t.requestSent;
        this.leaveForm = { leave_type: 'paid_leave', start_date: '', end_date: '', reason: '' };
        this.loadCurrentView();
      },
      error: response => {
        this.submitting = false;
        this.error = this.responseError(response);
      },
    });
  }

  decideRequest(item: any, action: 'approve' | 'reject'): void {
    const endpoint = item.kind === 'leave'
      ? `leave-requests/${item.id}/decision`
      : `transfer-requests/${item.id}/decision`;
    this.submitting = true;
    this.http.post<any>(`${this.api}/${endpoint}/`, { action }).subscribe({
      next: () => { this.submitting = false; this.loadCurrentView(); this.loadNotificationSummary(); },
      error: response => { this.submitting = false; this.error = this.responseError(response); },
    });
  }

  markAbsent(member: any): void {
    if (!window.confirm(this.t.confirmAbsent.replace('{name}', member.name))) return;
    this.markingAbsentId = member.id;
    this.error = '';
    this.http.post<any>(`${this.api}/teams/members/${member.id}/absent/`, {
      actor_context: this.view === 'missing' ? 'level_1' : undefined,
    }).subscribe({
      next: response => {
        member.status = response.status;
        member.can_mark_absent = false;
        member.marked_by = response.marked_by?.name || '';
        member.marked_at = response.marked_at;
        member.source = response.source;
        this.markingAbsentId = null;
        this.notifications = this.notifications
          .map(item => ({ ...item, employees: item.employees.filter((employee: any) => employee.id !== member.id) }))
          .filter(item => item.employees.length);
        if (this.missing) {
          const row = (this.missing.employees || []).find((item: any) => item.id === member.id);
          if (row && row !== member) Object.assign(row, member);
        }
        if (this.dashboard) {
          this.dashboard.unread_notifications = this.notifications.filter(item => !item.is_read).length;
          if (typeof this.dashboard.missing_today_count === 'number') {
            this.dashboard.missing_today_count = Math.max(0, this.dashboard.missing_today_count - 1);
          }
        }
      },
      error: response => {
        this.markingAbsentId = null;
        this.error = this.responseError(response);
      },
    });
  }

  lockedNotice(lockTime: string): string {
    return this.t.lockedInfo.replace('{time}', lockTime || '08:10');
  }

  availableNotice(time: string): string {
    return this.t.availableFrom.replace('{time}', time || '07:55');
  }

  /** Butonul „Sună șeful de echipă” apare doar când există șef și telefon. */
  canCallLeader(person: any): boolean {
    return !!(person?.team?.leader_name && person?.team?.leader_phone);
  }

  markRead(notification: any): void {
    this.http.post<any>(`${this.api}/notifications/`, { notification_ids: [notification.id], notification_kind: notification.kind || 'team' }).subscribe({
      next: response => {
        notification.is_read = true;
        if (this.dashboard) this.dashboard.unread_notifications = response.unread_count || 0;
      },
    });
  }

  openNotification(notification: any): void {
    const navigate = () => {
      if (notification.target_path) {
        void this.router.navigateByUrl(notification.target_path, {
          state: { teamDashboardOrigin: this.router.url },
        });
      }
    };
    if (notification.is_read) {
      navigate();
      return;
    }
    this.http.post<any>(`${this.api}/notifications/`, {
      notification_ids: [notification.id],
      notification_kind: notification.kind || 'team',
    }).subscribe({
      next: response => {
        notification.is_read = true;
        if (this.dashboard) this.dashboard.unread_notifications = response.unread_count || 0;
        navigate();
      },
      error: () => navigate(),
    });
  }

  statusLabel(status: string): string {
    if (status === 'present') return this.t.present;
    if (status === 'leave') return this.t.leave;
    if (status === 'marked_absent') return this.t.markedAbsent;
    if (status === 'not_required') return this.t.notRequired;
    return this.t.absent;
  }
  statusIcon(status: string): string { return status === 'present' ? 'check_circle' : status === 'leave' ? 'beach_access' : status === 'not_required' ? 'event_busy' : 'error'; }

  requestStatusLabel(status: string): string {
    if (status === 'approved') return this.t.requestApproved;
    if (status === 'rejected') return this.t.requestRejected;
    if (status === 'cancelled') return this.t.requestCancelled;
    return this.t.requestPending;
  }

  leaveTypeLabel(type: string): string {
    return type === 'unpaid_leave' ? this.t.unpaidLeave : this.t.paidLeave;
  }

  absenceCategoryLabel(category: string): string {
    if (category === 'marked_by_level_1') return this.t.absentByLevel1;
    if (category === 'marked_by_team_leader') return this.t.absentByLeader;
    if (category === 'marked_by_supervisor') return this.t.absentBySupervisor;
    return this.t.scheduledAbsent;
  }

  notificationTitle(notification: any): string {
    if (notification?.kind === 'leave_approval') return this.t.newLeaveNotification;
    if (notification?.kind === 'transfer_approval') return this.t.newTransferNotification;
    if (notification?.kind === 'leave_result') return this.t.leaveResultNotification;
    if (notification?.kind === 'transfer_result') return this.t.transferResultNotification;
    return notification?.kind === 'personal_leave' ? this.t.leaveRequest : (notification?.team?.name || this.t.notifications);
  }

  notificationEmployeeLabel(notification: any, employee: any): string {
    if (notification?.kind !== 'personal_leave') return employee.name;
    return this.leaveTypeLabel(notification.leave_type);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  /** Polling ușor: compară ora Europe/Bucharest și reîncarcă numai datele API. */
  private startTimedRefreshPolling(): void {
    this.checkTimedRefresh();
    this.refreshPoll = setInterval(() => this.checkTimedRefresh(), 15000);
  }

  private checkTimedRefresh(): void {
    this.loadNotificationSummary();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const dateKey = `${values['year']}-${values['month']}-${values['day']}`;
    const minutes = Number(values['hour']) * 60 + Number(values['minute']);
    const thresholds = [
      { key: '0740', minute: 7 * 60 + 40, active: ['home', 'team', 'supervised', 'notifications'].includes(this.view) },
      { key: '0755', minute: 7 * 60 + 55, active: this.isLevel1 && ['home', 'missing', 'notifications'].includes(this.view) },
      { key: '0810', minute: 8 * 60 + 10, active: this.isLevel2 && ['home', 'absent', 'notifications'].includes(this.view) },
    ];
    for (const threshold of thresholds) {
      const key = `${dateKey}-${threshold.key}`;
      if (threshold.active && minutes >= threshold.minute && !this.handledRefreshes.has(key)) {
        this.handledRefreshes.add(key);
        this.loadCurrentView();
      }
    }
  }

  private loadNotificationSummary(): void {
    this.http.get<any>(`${this.api}/notifications/summary/`).subscribe({
      next: data => {
        if (!this.dashboard) this.dashboard = {};
        this.dashboard.unread_notifications = Number(data.unread_count || 0);
      },
    });
  }

  private scrollToFocusedRequest(): void {
    if (!this.focusRequestId || !['leaveApprovals', 'transferApprovals'].includes(this.view)) return;
    setTimeout(() => document.getElementById(`request-${this.focusRequestId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  private normalize(value: string): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private responseError(response: any): string {
    return this.language === 'ro' ? (response?.error?.error || this.t.error) : this.t.error;
  }

  private readLanguage(): PortalLanguage {
    const saved = localStorage.getItem('team-portal-language');
    return saved === 'ro' || saved === 'pa' || saved === 'hi' || saved === 'ne' ? saved : 'en';
  }
}
