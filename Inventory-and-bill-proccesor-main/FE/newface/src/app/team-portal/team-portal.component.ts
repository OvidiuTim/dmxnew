import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../auth/auth.service';

type PortalLanguage = 'en' | 'pa' | 'hi' | 'ne';
type PortalView = 'home' | 'salary' | 'team' | 'notifications';
interface PortalCopy {
  dashboard: string; welcome: string; language: string; attendance: string; employeeFile: string;
  myTeam: string; notifications: string; clockHint: string; salaryHint: string; teamHint: string;
  notificationHint: string; back: string; totalSalary: string; advance: string; settlement: string;
  lei: string; present: string; absent: string; leave: string; phone: string; call: string;
  noPhone: string; noMembers: string; noNotifications: string; checkedAt: string; markRead: string;
  read: string; unread: string; signOut: string; loading: string; retry: string; error: string; roles: string;
}

@Component({
  selector: 'app-team-portal',
  templateUrl: './team-portal.component.html',
  styleUrls: ['./team-portal.component.css'],
})
export class TeamPortalComponent implements OnInit {
  private readonly api = `${window.location.origin}/api/team-portal`;
  readonly languages: Array<{ code: PortalLanguage; label: string }> = [
    { code: 'en', label: 'English' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'ne', label: 'नेपाली' },
  ];
  readonly copy: Record<PortalLanguage, PortalCopy> = {
    en: {
      dashboard: 'Team dashboard', welcome: 'Welcome', language: 'Language', attendance: 'Attendance', employeeFile: 'Employee file',
      myTeam: 'My team', notifications: 'Notifications', clockHint: 'Clock in or out for your own account', salaryHint: 'View your salary summary',
      teamHint: 'See only the teams you coordinate', notificationHint: 'Members without attendance by 07:40', back: 'Back to dashboard',
      totalSalary: 'Total salary', advance: 'Advance', settlement: 'Settlement', lei: 'lei', present: 'Clocked in', absent: 'Not clocked in',
      leave: 'On leave', phone: 'Phone number', call: 'Call', noPhone: 'No phone number', noMembers: 'No members found.',
      noNotifications: 'No attendance notifications.', checkedAt: 'Checked at', markRead: 'Mark as read', read: 'Read', unread: 'Unread',
      signOut: 'Sign out', loading: 'Loading…', retry: 'Retry', error: 'The information could not be loaded.', roles: 'Team leader / Supervisor',
    },
    pa: {
      dashboard: 'ਟੀਮ ਡੈਸ਼ਬੋਰਡ', welcome: 'ਜੀ ਆਇਆਂ ਨੂੰ', language: 'ਭਾਸ਼ਾ', attendance: 'ਹਾਜ਼ਰੀ', employeeFile: 'ਕਰਮਚਾਰੀ ਵੇਰਵਾ',
      myTeam: 'ਮੇਰੀ ਟੀਮ', notifications: 'ਸੂਚਨਾਵਾਂ', clockHint: 'ਆਪਣੇ ਖਾਤੇ ਲਈ ਚੈਕ ਇਨ ਜਾਂ ਚੈਕ ਆਉਟ ਕਰੋ', salaryHint: 'ਆਪਣੀ ਤਨਖਾਹ ਦਾ ਸਾਰ ਵੇਖੋ',
      teamHint: 'ਸਿਰਫ਼ ਆਪਣੀਆਂ ਟੀਮਾਂ ਵੇਖੋ', notificationHint: '07:40 ਤੱਕ ਹਾਜ਼ਰੀ ਨਾ ਲਗਾਉਣ ਵਾਲੇ ਮੈਂਬਰ', back: 'ਡੈਸ਼ਬੋਰਡ ਤੇ ਵਾਪਸ',
      totalSalary: 'ਕੁੱਲ ਤਨਖਾਹ', advance: 'ਅਡਵਾਂਸ', settlement: 'ਬਾਕੀ ਭੁਗਤਾਨ', lei: 'ਲੇਈ', present: 'ਹਾਜ਼ਰ', absent: 'ਹਾਜ਼ਰੀ ਨਹੀਂ',
      leave: 'ਛੁੱਟੀ ਤੇ', phone: 'ਫੋਨ ਨੰਬਰ', call: 'ਕਾਲ ਕਰੋ', noPhone: 'ਫੋਨ ਨੰਬਰ ਨਹੀਂ', noMembers: 'ਕੋਈ ਮੈਂਬਰ ਨਹੀਂ ਮਿਲਿਆ।',
      noNotifications: 'ਕੋਈ ਹਾਜ਼ਰੀ ਸੂਚਨਾ ਨਹੀਂ।', checkedAt: 'ਜਾਂਚ ਦਾ ਸਮਾਂ', markRead: 'ਪੜ੍ਹਿਆ ਨਿਸ਼ਾਨ ਲਗਾਓ', read: 'ਪੜ੍ਹਿਆ', unread: 'ਨਵੀਂ',
      signOut: 'ਲਾਗ ਆਉਟ', loading: 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…', retry: 'ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼', error: 'ਜਾਣਕਾਰੀ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ।', roles: 'ਟੀਮ ਲੀਡਰ / ਸੁਪਰਵਾਈਜ਼ਰ',
    },
    hi: {
      dashboard: 'टीम डैशबोर्ड', welcome: 'स्वागत है', language: 'भाषा', attendance: 'उपस्थिति', employeeFile: 'कर्मचारी विवरण',
      myTeam: 'मेरी टीम', notifications: 'सूचनाएं', clockHint: 'अपने खाते के लिए चेक इन या चेक आउट करें', salaryHint: 'अपना वेतन सार देखें',
      teamHint: 'केवल अपनी टीम देखें', notificationHint: '07:40 तक उपस्थित न हुए सदस्य', back: 'डैशबोर्ड पर वापस',
      totalSalary: 'कुल वेतन', advance: 'अग्रिम', settlement: 'शेष भुगतान', lei: 'लेई', present: 'उपस्थित', absent: 'उपस्थित नहीं',
      leave: 'छुट्टी पर', phone: 'फोन नंबर', call: 'कॉल करें', noPhone: 'फोन नंबर नहीं', noMembers: 'कोई सदस्य नहीं मिला।',
      noNotifications: 'कोई उपस्थिति सूचना नहीं।', checkedAt: 'जांच का समय', markRead: 'पढ़ा हुआ करें', read: 'पढ़ा हुआ', unread: 'नई',
      signOut: 'लॉग आउट', loading: 'लोड हो रहा है…', retry: 'फिर प्रयास करें', error: 'जानकारी लोड नहीं हो सकी।', roles: 'टीम लीडर / सुपरवाइज़र',
    },
    ne: {
      dashboard: 'टोली ड्यासबोर्ड', welcome: 'स्वागत छ', language: 'भाषा', attendance: 'हाजिरी', employeeFile: 'कर्मचारी विवरण',
      myTeam: 'मेरो टोली', notifications: 'सूचनाहरू', clockHint: 'आफ्नो खाताको चेक इन वा चेक आउट गर्नुहोस्', salaryHint: 'आफ्नो तलब सारांश हेर्नुहोस्',
      teamHint: 'आफूले समन्वय गर्ने टोली मात्र हेर्नुहोस्', notificationHint: '07:40 सम्म हाजिर नभएका सदस्य', back: 'ड्यासबोर्डमा फर्कनुहोस्',
      totalSalary: 'कुल तलब', advance: 'अग्रिम', settlement: 'बाँकी भुक्तानी', lei: 'लेई', present: 'हाजिर', absent: 'हाजिर छैन',
      leave: 'बिदामा', phone: 'फोन नम्बर', call: 'फोन गर्नुहोस्', noPhone: 'फोन नम्बर छैन', noMembers: 'कुनै सदस्य भेटिएन।',
      noNotifications: 'कुनै हाजिरी सूचना छैन।', checkedAt: 'जाँच समय', markRead: 'पढिएको चिन्ह लगाउनुहोस्', read: 'पढिएको', unread: 'नयाँ',
      signOut: 'लग आउट', loading: 'लोड हुँदैछ…', retry: 'फेरि प्रयास', error: 'जानकारी लोड हुन सकेन।', roles: 'टोली प्रमुख / सुपरभाइजर',
    },
  };

  language: PortalLanguage = this.readLanguage();
  view: PortalView = 'home';
  dashboard: any = null;
  salary: any = null;
  teams: any[] = [];
  notifications: any[] = [];
  loading = true;
  error = '';
  openMemberId: number | null = null;

  constructor(private http: HttpClient, private auth: AuthService, private router: Router) {}

  ngOnInit(): void { this.loadHome(); }
  get t(): PortalCopy { return this.copy[this.language]; }
  get unreadCount(): number { return this.notifications.filter(item => !item.is_read).length || Number(this.dashboard?.unread_notifications || 0); }

  setLanguage(value: PortalLanguage): void {
    this.language = value;
    localStorage.setItem('team-portal-language', value);
    localStorage.setItem('clockinandout-language', value);
  }

  open(view: PortalView): void {
    this.view = view;
    this.error = '';
    if (view === 'home') return;
    this.loading = true;
    const source = view === 'salary'
      ? this.http.get<any>(`${this.api}/salary/`)
      : view === 'team'
        ? this.http.get<any>(`${this.api}/teams/`)
        : this.http.get<any>(`${this.api}/notifications/`);
    source.subscribe({
      next: response => {
        if (view === 'salary') this.salary = response;
        if (view === 'team') this.teams = response.teams || [];
        if (view === 'notifications') {
          this.notifications = response.notifications || [];
          if (this.dashboard) this.dashboard.unread_notifications = response.unread_count || 0;
        }
        this.loading = false;
      },
      error: () => { this.error = this.t.error; this.loading = false; },
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
    return this.t.absent;
  }
  statusIcon(status: string): string { return status === 'present' ? 'check_circle' : status === 'leave' ? 'beach_access' : 'error'; }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  private readLanguage(): PortalLanguage {
    const saved = localStorage.getItem('team-portal-language');
    return saved === 'pa' || saved === 'hi' || saved === 'ne' ? saved : 'en';
  }
}
