import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SharedService } from '../shared.service';
import { readEmployeeLanguage } from '../i18n/employee-language';
import { employeeCopy } from '../i18n/employee-copy';

@Component({
  selector: 'app-fleet',
  templateUrl: './fleet.component.html',
  styleUrls: ['./fleet.component.css']
})
export class FleetComponent implements OnInit {
  readonly language = readEmployeeLanguage();
  readonly ui = employeeCopy[this.language];
  readonly locale = { ro: 'ro-RO', en: 'en-GB', pa: 'pa-IN', hi: 'hi-IN', ne: 'ne-NP', bn: 'bn-BD' }[this.language];

  token = '';
  query = '';
  pin = '';
  counter: number | null = null;
  equipment: any = null;
  equipmentList: any[] = [];
  scannerOpen = false;
  loading = false;
  submitting = false;
  error = '';
  success = '';
  recommendationPhotos: Record<number, File | null> = {};
  readonly technicalCopy: Record<string, any> = {
    ro: { title: 'Recomandări tehnice scadente', responsible: 'Verificări de aprobat', due: 'Scadentă', low: 'Poți folosi utilajul, dar execută recomandarea cât mai curând.', medium: 'După trimiterea pozei, utilizarea se deblochează în 15 minute dacă nu există răspuns.', high: 'Utilajul rămâne blocat până la aprobarea responsabilului tehnic.', photo: 'Adaugă fotografia lucrării', submit: 'Trimite spre verificare', pending: 'Fotografie trimisă. Așteaptă verificarea.', blocked: 'Utilizarea este blocată de o recomandare tehnică.', approve: 'Aprobă', reject: 'Respinge', sent: 'Recomandarea a fost trimisă responsabilului tehnic.', approved: 'Verificarea a fost aprobată.', rejected: 'Verificarea a fost respinsă.', by: 'Trimisă de' },
    en: { title: 'Due technical recommendations', responsible: 'Checks to approve', due: 'Due', low: 'You may use the equipment, but complete this recommendation as soon as possible.', medium: 'After sending the photo, use is unlocked in 15 minutes if there is no response.', high: 'The equipment stays blocked until the technical manager approves it.', photo: 'Add a photo of the completed work', submit: 'Send for review', pending: 'Photo sent. Waiting for review.', blocked: 'Use is blocked by a technical recommendation.', approve: 'Approve', reject: 'Reject', sent: 'The recommendation was sent to the technical manager.', approved: 'The check was approved.', rejected: 'The check was rejected.', by: 'Sent by' },
    pa: { title: 'ਬਕਾਇਆ ਤਕਨੀਕੀ ਸਿਫ਼ਾਰਸ਼ਾਂ', responsible: 'ਮਨਜ਼ੂਰੀ ਲਈ ਜਾਂਚਾਂ', due: 'ਬਕਾਇਆ', low: 'ਤੁਸੀਂ ਮਸ਼ੀਨ ਵਰਤ ਸਕਦੇ ਹੋ, ਪਰ ਇਹ ਕੰਮ ਜਲਦੀ ਕਰੋ।', medium: 'ਫੋਟੋ ਭੇਜਣ ਤੋਂ 15 ਮਿੰਟ ਬਾਅਦ, ਜਵਾਬ ਨਾ ਆਉਣ ਤੇ ਵਰਤੋਂ ਖੁੱਲ ਜਾਵੇਗੀ।', high: 'ਤਕਨੀਕੀ ਜ਼ਿੰਮੇਵਾਰ ਦੀ ਮਨਜ਼ੂਰੀ ਤੱਕ ਮਸ਼ੀਨ ਬੰਦ ਰਹੇਗੀ।', photo: 'ਕੀਤੇ ਕੰਮ ਦੀ ਫੋਟੋ ਜੋੜੋ', submit: 'ਜਾਂਚ ਲਈ ਭੇਜੋ', pending: 'ਫੋਟੋ ਭੇਜੀ ਗਈ। ਜਾਂਚ ਦੀ ਉਡੀਕ ਹੈ।', blocked: 'ਤਕਨੀਕੀ ਸਿਫ਼ਾਰਸ਼ ਕਾਰਨ ਵਰਤੋਂ ਬੰਦ ਹੈ।', approve: 'ਮਨਜ਼ੂਰ', reject: 'ਰੱਦ', sent: 'ਸਿਫ਼ਾਰਸ਼ ਤਕਨੀਕੀ ਜ਼ਿੰਮੇਵਾਰ ਨੂੰ ਭੇਜੀ ਗਈ।', approved: 'ਜਾਂਚ ਮਨਜ਼ੂਰ ਹੋਈ।', rejected: 'ਜਾਂਚ ਰੱਦ ਹੋਈ।', by: 'ਭੇਜਣ ਵਾਲਾ' },
    hi: { title: 'लंबित तकनीकी सिफारिशें', responsible: 'स्वीकृति हेतु जाँच', due: 'लंबित', low: 'आप मशीन का उपयोग कर सकते हैं, लेकिन यह काम जल्द पूरा करें।', medium: 'फोटो भेजने के 15 मिनट बाद उत्तर न मिलने पर उपयोग खुल जाएगा।', high: 'तकनीकी जिम्मेदार की स्वीकृति तक मशीन बंद रहेगी।', photo: 'किए गए काम की फोटो जोड़ें', submit: 'जाँच के लिए भेजें', pending: 'फोटो भेजी गई। जाँच की प्रतीक्षा है।', blocked: 'तकनीकी सिफारिश के कारण उपयोग अवरुद्ध है।', approve: 'स्वीकृत करें', reject: 'अस्वीकृत करें', sent: 'सिफारिश तकनीकी जिम्मेदार को भेजी गई।', approved: 'जाँच स्वीकृत हुई।', rejected: 'जाँच अस्वीकृत हुई।', by: 'भेजने वाला' },
    ne: { title: 'बाँकी प्राविधिक सिफारिसहरू', responsible: 'स्वीकृत गर्नुपर्ने जाँचहरू', due: 'बाँकी', low: 'उपकरण प्रयोग गर्न सकिन्छ, तर यो काम चाँडै पूरा गर्नुहोस्।', medium: 'फोटो पठाएको १५ मिनेटपछि उत्तर नआए प्रयोग खुल्छ।', high: 'प्राविधिक जिम्मेवारले स्वीकृत नगरेसम्म उपकरण रोकिएको रहन्छ।', photo: 'सम्पन्न कामको फोटो थप्नुहोस्', submit: 'जाँचका लागि पठाउनुहोस्', pending: 'फोटो पठाइयो। जाँचको प्रतीक्षा छ।', blocked: 'प्राविधिक सिफारिसका कारण प्रयोग रोकिएको छ।', approve: 'स्वीकृत', reject: 'अस्वीकृत', sent: 'सिफारिस प्राविधिक जिम्मेवारलाई पठाइयो।', approved: 'जाँच स्वीकृत भयो।', rejected: 'जाँच अस्वीकृत भयो।', by: 'पठाउने' },
    bn: { title: 'বকেয়া প্রযুক্তিগত সুপারিশ', responsible: 'অনুমোদনের অপেক্ষায় যাচাই', due: 'বকেয়া', low: 'যন্ত্রটি ব্যবহার করা যাবে, তবে কাজটি দ্রুত সম্পন্ন করুন।', medium: 'ছবি পাঠানোর ১৫ মিনিট পর উত্তর না এলে ব্যবহার চালু হবে।', high: 'প্রযুক্তিগত দায়িত্বপ্রাপ্তের অনুমোদন না হওয়া পর্যন্ত ব্যবহার বন্ধ থাকবে।', photo: 'সম্পন্ন কাজের ছবি যোগ করুন', submit: 'যাচাইয়ের জন্য পাঠান', pending: 'ছবি পাঠানো হয়েছে। যাচাইয়ের অপেক্ষা।', blocked: 'প্রযুক্তিগত সুপারিশের কারণে ব্যবহার বন্ধ।', approve: 'অনুমোদন', reject: 'প্রত্যাখ্যান', sent: 'সুপারিশটি প্রযুক্তিগত দায়িত্বপ্রাপ্তকে পাঠানো হয়েছে।', approved: 'যাচাই অনুমোদিত হয়েছে।', rejected: 'যাচাই প্রত্যাখ্যাত হয়েছে।', by: 'পাঠিয়েছেন' },
  };

  constructor(private route: ActivatedRoute, private router: Router, private api: SharedService) {}

  ngOnInit(): void {
    this.token = String(this.route.snapshot.paramMap.get('token') || '');
    if (this.token) this.loadEquipment(this.token);
  }

  loadList(): void {
    this.loading = true;
    this.api.getFleetEquipment().subscribe({
      next: response => { this.equipmentList = response?.equipment || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  search(): void {
    if (!this.query.trim()) return;
    this.loading = true;
    this.error = '';
    this.api.lookupFleetEquipment(this.query.trim()).subscribe({
      next: response => {
        this.loading = false;
        const item = response?.equipment;
        if (item?.token) this.navigateToEquipment(item.token);
      },
      error: error => { this.loading = false; this.error = this.apiError(error); }
    });
  }

  open(item: any): void {
    this.navigateToEquipment(item.token);
  }

  scanSuccess(value: string): void {
    const scanned = String(value || '').trim();
    if (!scanned) return;
    this.scannerOpen = false;
    const token = scanned.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
    if (token) {
      this.navigateToEquipment(token);
      return;
    }
    this.query = scanned;
    this.search();
  }

  back(): void {
    if (this.token) {
      void this.router.navigateByUrl(this.isTeamDashboard ? '/team-dashboard/utilaje' : '/team-dashboard');
    } else {
      void this.router.navigateByUrl('/team-dashboard');
    }
  }

  get isTeamDashboard(): boolean {
    return this.router.url.startsWith('/team-dashboard/');
  }

  take(): void { this.submitAction('take'); }
  giveBack(): void { this.submitAction('return'); }

  documentLabel(document: any): string {
    if (document.status === 'missing') return this.ui.fleetDocumentMissing;
    if (document.status === 'expired') return this.ui.fleetDocumentExpired;
    if (!document.expiry_date) return this.ui.fleetDocumentValid;
    const date = new Intl.DateTimeFormat(this.locale).format(new Date(`${document.expiry_date}T12:00:00`));
    return document.status === 'warning'
      ? `${this.ui.fleetExpiresSoon} ${date}`
      : `${this.ui.fleetValidUntil} ${date}`;
  }

  get tc(): any { return this.technicalCopy[this.language] || this.technicalCopy['ro']; }

  recommendationHint(item: any): string {
    if (item.pending_submission) return this.tc.pending;
    return item.importance === 'high' ? this.tc.high : item.importance === 'medium' ? this.tc.medium : this.tc.low;
  }

  setRecommendationPhoto(id: number, event: Event): void {
    this.recommendationPhotos[id] = (event.target as HTMLInputElement).files?.[0] || null;
  }

  submitRecommendation(item: any): void {
    const photo = this.recommendationPhotos[item.id];
    if (!photo || this.submitting) return;
    const data = new FormData();
    data.append('photo', photo);
    if (this.pin.trim()) data.append('pin', this.pin.trim());
    this.submitting = true;
    this.error = '';
    this.api.submitFleetRecommendation(this.equipment.token, item.id, data).subscribe({
      next: response => {
        this.submitting = false;
        this.equipment = response?.equipment;
        this.recommendationPhotos[item.id] = null;
        this.success = this.tc.sent;
      },
      error: error => { this.submitting = false; this.error = this.apiError(error); },
    });
  }

  decideRecommendation(item: any, action: 'approve' | 'reject'): void {
    if (this.submitting) return;
    const note = action === 'reject' ? (window.prompt(this.tc.reject) || '') : '';
    this.submitting = true;
    this.error = '';
    this.api.decideFleetRecommendation(item.id, { action, note }).subscribe({
      next: response => {
        this.submitting = false;
        this.equipment = response?.equipment;
        this.success = action === 'approve' ? this.tc.approved : this.tc.rejected;
      },
      error: error => { this.submitting = false; this.error = this.apiError(error); },
    });
  }

  private loadEquipment(token: string): void {
    this.loading = true;
    this.error = '';
    this.api.getFleetEquipmentByToken(token).subscribe({
      next: response => { this.equipment = response?.equipment; this.loading = false; },
      error: error => { this.loading = false; this.error = this.apiError(error); }
    });
  }

  private navigateToEquipment(token: string): void {
    void this.router.navigate([this.isTeamDashboard ? '/team-dashboard/utilaje' : '/pontaj/utilaj', token]);
  }

  private submitAction(action: 'take' | 'return'): void {
    if (!this.equipment || this.submitting) return;
    this.submitting = true;
    this.error = '';
    this.success = '';
    const send = (gps?: GeolocationPosition) => {
      const payload = {
        pin: this.pin.trim(),
        counter: this.counter,
        gps: gps ? { lat: gps.coords.latitude, lng: gps.coords.longitude, accuracy: gps.coords.accuracy } : undefined
      };
      const request = action === 'take'
        ? this.api.takeFleetEquipment(this.equipment.token, payload)
        : this.api.returnFleetEquipment(this.equipment.token, payload);
      request.subscribe({
        next: response => {
          this.submitting = false;
          this.equipment = response?.equipment;
          this.pin = '';
          this.counter = null;
          this.success = action === 'take' ? this.ui.fleetTakenSuccess : this.ui.fleetReturnedSuccess;
        },
        error: error => { this.submitting = false; this.error = this.apiError(error); }
      });
    };
    if (action === 'take' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(send, () => send(), { enableHighAccuracy: true, timeout: 8000 });
    } else send();
  }

  private apiError(error: any): string {
    return String(error?.error?.error || this.ui.error);
  }
}
