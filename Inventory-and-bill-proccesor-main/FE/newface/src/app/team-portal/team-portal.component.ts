import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { AuthService } from '../auth/auth.service';

type PortalLanguage = 'ro' | 'en' | 'pa' | 'hi' | 'ne';
type PortalView = 'home' | 'salary' | 'team' | 'notifications' | 'missing' | 'absent';
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
}

@Component({
  selector: 'app-team-portal',
  templateUrl: './team-portal.component.html',
  styleUrls: ['./team-portal.component.css'],
})
export class TeamPortalComponent implements OnInit {
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
      teamHint: 'Vezi numai echipele pe care le coordonezi', notificationHint: 'Membri fără pontaj până la 07:40', back: 'Înapoi la dashboard',
      totalSalary: 'Salariu total', advance: 'Avans', settlement: 'Lichidare', lei: 'lei', present: 'Pontat', absent: 'Nepontat',
      leave: 'În concediu', phone: 'Număr de telefon', call: 'Sună', noPhone: 'Fără număr de telefon', noMembers: 'Nu există membri.',
      noNotifications: 'Nu există notificări de pontaj.', checkedAt: 'Verificat la', markRead: 'Marchează citită', read: 'Citită', unread: 'Necitită',
      signOut: 'Deconectare', loading: 'Se încarcă…', retry: 'Reîncearcă', error: 'Informațiile nu au putut fi încărcate.', roles: 'Șef de echipă / Supervisor',
      markAbsent: 'Marchează absent', markedAbsent: 'Absent', notRequired: 'Nu se pontează', confirmAbsent: 'Confirmi marcarea ca absent pentru {name} astăzi?', markingAbsent: 'Se salvează…', absentSaved: 'Absența a fost salvată.',
      seeMissing: 'Vezi lipsă', seeMissingHint: 'Toți angajații companiei care nu s-au pontat astăzi', absentToday: 'Lipsă azi', absentTodayHint: 'Absenții zilei, la nivel de companie', teamLabel: 'Echipă',
      leaderLabel: 'Șef de echipă', leaderPhone: 'Telefon șef', noMissing: 'Toți angajații s-au pontat astăzi.', noAbsent: 'Nu există absenți astăzi.', lockedInfo: 'După ora {time} absențele sunt trecute automat și nu mai pot fi modificate.',
      markedBy: 'Marcat de', markedAt: 'Marcat la', callLeader: 'Sună șeful', checkedInLater: 'S-a pontat ulterior', teamLeaderRole: 'Șef de echipă', noTeam: 'Fără echipă',
    },
    en: {
      dashboard: 'Team dashboard', welcome: 'Welcome', language: 'Language', attendance: 'Attendance', employeeFile: 'Employee file',
      myTeam: 'My team', notifications: 'Notifications', clockHint: 'Clock in or out for your own account', salaryHint: 'View your salary summary',
      teamHint: 'See only the teams you coordinate', notificationHint: 'Members without attendance by 07:40', back: 'Back to dashboard',
      totalSalary: 'Total salary', advance: 'Advance', settlement: 'Settlement', lei: 'lei', present: 'Clocked in', absent: 'Not clocked in',
      leave: 'On leave', phone: 'Phone number', call: 'Call', noPhone: 'No phone number', noMembers: 'No members found.',
      noNotifications: 'No attendance notifications.', checkedAt: 'Checked at', markRead: 'Mark as read', read: 'Read', unread: 'Unread',
      signOut: 'Sign out', loading: 'Loading…', retry: 'Retry', error: 'The information could not be loaded.', roles: 'Team leader / Supervisor',
      markAbsent: 'Mark absent', markedAbsent: 'Absent', notRequired: 'Attendance not required', confirmAbsent: 'Mark {name} absent for today?', markingAbsent: 'Saving…', absentSaved: 'The absence was saved.',
      seeMissing: 'Missing today', seeMissingHint: 'Every company employee without attendance today', absentToday: 'Absent today', absentTodayHint: "Today's absences, company-wide", teamLabel: 'Team',
      leaderLabel: 'Team leader', leaderPhone: 'Leader phone', noMissing: 'Everyone clocked in today.', noAbsent: 'No absences today.', lockedInfo: 'After {time} absences are recorded automatically and can no longer be changed.',
      markedBy: 'Marked by', markedAt: 'Marked at', callLeader: 'Call leader', checkedInLater: 'Clocked in later', teamLeaderRole: 'Team leader', noTeam: 'No team',
    },
    pa: {
      dashboard: 'ਟੀਮ ਡੈਸ਼ਬੋਰਡ', welcome: 'ਜੀ ਆਇਆਂ ਨੂੰ', language: 'ਭਾਸ਼ਾ', attendance: 'ਹਾਜ਼ਰੀ', employeeFile: 'ਕਰਮਚਾਰੀ ਵੇਰਵਾ',
      myTeam: 'ਮੇਰੀ ਟੀਮ', notifications: 'ਸੂਚਨਾਵਾਂ', clockHint: 'ਆਪਣੇ ਖਾਤੇ ਲਈ ਚੈਕ ਇਨ ਜਾਂ ਚੈਕ ਆਉਟ ਕਰੋ', salaryHint: 'ਆਪਣੀ ਤਨਖਾਹ ਦਾ ਸਾਰ ਵੇਖੋ',
      teamHint: 'ਸਿਰਫ਼ ਆਪਣੀਆਂ ਟੀਮਾਂ ਵੇਖੋ', notificationHint: '07:40 ਤੱਕ ਹਾਜ਼ਰੀ ਨਾ ਲਗਾਉਣ ਵਾਲੇ ਮੈਂਬਰ', back: 'ਡੈਸ਼ਬੋਰਡ ਤੇ ਵਾਪਸ',
      totalSalary: 'ਕੁੱਲ ਤਨਖਾਹ', advance: 'ਅਡਵਾਂਸ', settlement: 'ਬਾਕੀ ਭੁਗਤਾਨ', lei: 'ਲੇਈ', present: 'ਹਾਜ਼ਰ', absent: 'ਹਾਜ਼ਰੀ ਨਹੀਂ',
      leave: 'ਛੁੱਟੀ ਤੇ', phone: 'ਫੋਨ ਨੰਬਰ', call: 'ਕਾਲ ਕਰੋ', noPhone: 'ਫੋਨ ਨੰਬਰ ਨਹੀਂ', noMembers: 'ਕੋਈ ਮੈਂਬਰ ਨਹੀਂ ਮਿਲਿਆ।',
      noNotifications: 'ਕੋਈ ਹਾਜ਼ਰੀ ਸੂਚਨਾ ਨਹੀਂ।', checkedAt: 'ਜਾਂਚ ਦਾ ਸਮਾਂ', markRead: 'ਪੜ੍ਹਿਆ ਨਿਸ਼ਾਨ ਲਗਾਓ', read: 'ਪੜ੍ਹਿਆ', unread: 'ਨਵੀਂ',
      signOut: 'ਲਾਗ ਆਉਟ', loading: 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…', retry: 'ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼', error: 'ਜਾਣਕਾਰੀ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ।', roles: 'ਟੀਮ ਲੀਡਰ / ਸੁਪਰਵਾਈਜ਼ਰ',
      markAbsent: 'ਗੈਰਹਾਜ਼ਰ ਨਿਸ਼ਾਨ ਲਗਾਓ', markedAbsent: 'ਗੈਰਹਾਜ਼ਰ', notRequired: 'ਹਾਜ਼ਰੀ ਲਾਜ਼ਮੀ ਨਹੀਂ', confirmAbsent: 'ਕੀ {name} ਨੂੰ ਅੱਜ ਗੈਰਹਾਜ਼ਰ ਨਿਸ਼ਾਨ ਲਗਾਉਣਾ ਹੈ?', markingAbsent: 'ਸੇਵ ਹੋ ਰਿਹਾ ਹੈ…', absentSaved: 'ਗੈਰਹਾਜ਼ਰੀ ਸੇਵ ਹੋ ਗਈ।',
      seeMissing: 'ਅੱਜ ਗੈਰਹਾਜ਼ਰ', seeMissingHint: 'ਕੰਪਨੀ ਦੇ ਸਾਰੇ ਕਰਮਚਾਰੀ ਜਿਨ੍ਹਾਂ ਨੇ ਅੱਜ ਹਾਜ਼ਰੀ ਨਹੀਂ ਲਗਾਈ', absentToday: 'ਅੱਜ ਦੀ ਗੈਰਹਾਜ਼ਰੀ', absentTodayHint: 'ਪੂਰੀ ਕੰਪਨੀ ਦੀ ਅੱਜ ਦੀ ਗੈਰਹਾਜ਼ਰੀ', teamLabel: 'ਟੀਮ',
      leaderLabel: 'ਟੀਮ ਲੀਡਰ', leaderPhone: 'ਲੀਡਰ ਦਾ ਫੋਨ', noMissing: 'ਅੱਜ ਸਾਰਿਆਂ ਨੇ ਹਾਜ਼ਰੀ ਲਗਾਈ।', noAbsent: 'ਅੱਜ ਕੋਈ ਗੈਰਹਾਜ਼ਰ ਨਹੀਂ।', lockedInfo: '{time} ਤੋਂ ਬਾਅਦ ਗੈਰਹਾਜ਼ਰੀ ਆਪਣੇ ਆਪ ਦਰਜ ਹੁੰਦੀ ਹੈ ਅਤੇ ਬਦਲੀ ਨਹੀਂ ਜਾ ਸਕਦੀ।',
      markedBy: 'ਨਿਸ਼ਾਨ ਲਗਾਉਣ ਵਾਲਾ', markedAt: 'ਸਮਾਂ', callLeader: 'ਲੀਡਰ ਨੂੰ ਕਾਲ ਕਰੋ', checkedInLater: 'ਬਾਅਦ ਵਿੱਚ ਹਾਜ਼ਰੀ ਲਗਾਈ', teamLeaderRole: 'ਟੀਮ ਲੀਡਰ', noTeam: 'ਟੀਮ ਨਹੀਂ',
    },
    hi: {
      dashboard: 'टीम डैशबोर्ड', welcome: 'स्वागत है', language: 'भाषा', attendance: 'उपस्थिति', employeeFile: 'कर्मचारी विवरण',
      myTeam: 'मेरी टीम', notifications: 'सूचनाएं', clockHint: 'अपने खाते के लिए चेक इन या चेक आउट करें', salaryHint: 'अपना वेतन सार देखें',
      teamHint: 'केवल अपनी टीम देखें', notificationHint: '07:40 तक उपस्थित न हुए सदस्य', back: 'डैशबोर्ड पर वापस',
      totalSalary: 'कुल वेतन', advance: 'अग्रिम', settlement: 'शेष भुगतान', lei: 'लेई', present: 'उपस्थित', absent: 'उपस्थित नहीं',
      leave: 'छुट्टी पर', phone: 'फोन नंबर', call: 'कॉल करें', noPhone: 'फोन नंबर नहीं', noMembers: 'कोई सदस्य नहीं मिला।',
      noNotifications: 'कोई उपस्थिति सूचना नहीं।', checkedAt: 'जांच का समय', markRead: 'पढ़ा हुआ करें', read: 'पढ़ा हुआ', unread: 'नई',
      signOut: 'लॉग आउट', loading: 'लोड हो रहा है…', retry: 'फिर प्रयास करें', error: 'जानकारी लोड नहीं हो सकी।', roles: 'टीम लीडर / सुपरवाइज़र',
      markAbsent: 'अनुपस्थित करें', markedAbsent: 'अनुपस्थित', notRequired: 'उपस्थिति आवश्यक नहीं', confirmAbsent: 'क्या {name} को आज अनुपस्थित चिह्नित करना है?', markingAbsent: 'सहेजा जा रहा है…', absentSaved: 'अनुपस्थिति सहेजी गई।',
      seeMissing: 'आज अनुपस्थित', seeMissingHint: 'कंपनी के सभी कर्मचारी जिन्होंने आज उपस्थिति नहीं लगाई', absentToday: 'आज की अनुपस्थिति', absentTodayHint: 'पूरी कंपनी की आज की अनुपस्थिति', teamLabel: 'टीम',
      leaderLabel: 'टीम लीडर', leaderPhone: 'लीडर का फोन', noMissing: 'आज सभी ने उपस्थिति लगाई।', noAbsent: 'आज कोई अनुपस्थित नहीं।', lockedInfo: '{time} के बाद अनुपस्थिति स्वतः दर्ज होती है और बदली नहीं जा सकती।',
      markedBy: 'चिह्नित किया', markedAt: 'समय', callLeader: 'लीडर को कॉल करें', checkedInLater: 'बाद में उपस्थिति लगाई', teamLeaderRole: 'टीम लीडर', noTeam: 'कोई टीम नहीं',
    },
    ne: {
      dashboard: 'टोली ड्यासबोर्ड', welcome: 'स्वागत छ', language: 'भाषा', attendance: 'हाजिरी', employeeFile: 'कर्मचारी विवरण',
      myTeam: 'मेरो टोली', notifications: 'सूचनाहरू', clockHint: 'आफ्नो खाताको चेक इन वा चेक आउट गर्नुहोस्', salaryHint: 'आफ्नो तलब सारांश हेर्नुहोस्',
      teamHint: 'आफूले समन्वय गर्ने टोली मात्र हेर्नुहोस्', notificationHint: '07:40 सम्म हाजिर नभएका सदस्य', back: 'ड्यासबोर्डमा फर्कनुहोस्',
      totalSalary: 'कुल तलब', advance: 'अग्रिम', settlement: 'बाँकी भुक्तानी', lei: 'लेई', present: 'हाजिर', absent: 'हाजिर छैन',
      leave: 'बिदामा', phone: 'फोन नम्बर', call: 'फोन गर्नुहोस्', noPhone: 'फोन नम्बर छैन', noMembers: 'कुनै सदस्य भेटिएन।',
      noNotifications: 'कुनै हाजिरी सूचना छैन।', checkedAt: 'जाँच समय', markRead: 'पढिएको चिन्ह लगाउनुहोस्', read: 'पढिएको', unread: 'नयाँ',
      signOut: 'लग आउट', loading: 'लोड हुँदैछ…', retry: 'फेरि प्रयास', error: 'जानकारी लोड हुन सकेन।', roles: 'टोली प्रमुख / सुपरभाइजर',
      markAbsent: 'अनुपस्थित चिन्ह लगाउनुहोस्', markedAbsent: 'अनुपस्थित', notRequired: 'हाजिरी आवश्यक छैन', confirmAbsent: 'के {name} लाई आज अनुपस्थित चिन्ह लगाउने?', markingAbsent: 'सुरक्षित हुँदैछ…', absentSaved: 'अनुपस्थिति सुरक्षित भयो।',
      seeMissing: 'आज अनुपस्थित', seeMissingHint: 'आज हाजिर नभएका कम्पनीका सबै कर्मचारी', absentToday: 'आजको अनुपस्थिति', absentTodayHint: 'पूरै कम्पनीको आजको अनुपस्थिति', teamLabel: 'टोली',
      leaderLabel: 'टोली प्रमुख', leaderPhone: 'प्रमुखको फोन', noMissing: 'आज सबैले हाजिरी गरे।', noAbsent: 'आज कोही अनुपस्थित छैन।', lockedInfo: '{time} पछि अनुपस्थिति स्वतः दर्ता हुन्छ र परिवर्तन गर्न मिल्दैन।',
      markedBy: 'चिन्ह लगाउने', markedAt: 'समय', callLeader: 'प्रमुखलाई फोन', checkedInLater: 'पछि हाजिर भयो', teamLeaderRole: 'टोली प्रमुख', noTeam: 'टोली छैन',
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
  teamsLocked = false;
  teamsLockTime = '08:10';
  loading = true;
  error = '';
  openMemberId: number | null = null;
  markingAbsentId: number | null = null;
  notice = '';

  constructor(private http: HttpClient, private auth: AuthService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.view = (this.route.snapshot.data['portalView'] || 'home') as PortalView;
    this.loadCurrentView();
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
    if (this.dashboard.is_supervisor && !this.dashboard.alert_level_1 && !this.dashboard.alert_level_2) labels.push('Supervisor');
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
      notifications: '/team-dashboard/notificari', missing: '/team-dashboard/vezi-lipsa', absent: '/team-dashboard/lipsa-azi'
    };
    void this.router.navigateByUrl(paths[view]);
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
    };
    // Cardurile globale au nevoie și de dashboard, pentru rolurile din header.
    const needsDashboard = !this.dashboard && (this.view === 'missing' || this.view === 'absent');
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
        }
        if (this.view === 'missing') this.missing = data;
        if (this.view === 'absent') this.absentToday = data;
        if (this.view === 'notifications') {
          this.notifications = data.notifications || [];
          if (this.dashboard) this.dashboard.unread_notifications = data.unread_count || 0;
        }
        this.loading = false;
      },
      error: response => { this.error = response?.error?.error || this.t.error; this.loading = false; },
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

  markAbsent(member: any): void {
    if (!window.confirm(this.t.confirmAbsent.replace('{name}', member.name))) return;
    this.markingAbsentId = member.id;
    this.error = '';
    this.http.post<any>(`${this.api}/teams/members/${member.id}/absent/`, {}).subscribe({
      next: response => {
        member.status = response.status;
        this.markingAbsentId = null;
        this.notice = this.t.absentSaved;
        this.notifications = this.notifications
          .map(item => ({ ...item, employees: item.employees.filter((employee: any) => employee.id !== member.id) }))
          .filter(item => item.employees.length);
        if (this.missing) {
          this.missing.employees = (this.missing.employees || []).filter((item: any) => item.id !== member.id);
          this.missing.count = this.missing.employees.length;
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
        this.error = response?.error?.error || this.t.error;
      },
    });
  }

  lockedNotice(lockTime: string): string {
    return this.t.lockedInfo.replace('{time}', lockTime || '08:10');
  }

  markRead(notification: any): void {
    this.http.post<any>(`${this.api}/notifications/`, { notification_ids: [notification.id] }).subscribe({
      next: response => {
        notification.is_read = true;
        if (this.dashboard) this.dashboard.unread_notifications = response.unread_count || 0;
      },
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

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  private readLanguage(): PortalLanguage {
    const saved = localStorage.getItem('team-portal-language');
    return saved === 'ro' || saved === 'pa' || saved === 'hi' || saved === 'ne' ? saved : 'en';
  }
}
