import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { SharedService } from '../shared.service';

type LanguageCode = 'ro' | 'en' | 'pa' | 'hi' | 'ne';
type FeedbackKind = 'enter' | 'exit' | 'error';
type AttendanceState = 'ENTER' | 'EXIT';
type LocationState = 'loading' | 'inside' | 'outside' | 'denied' | 'unsupported' | 'error';

interface LanguageOption {
  code: LanguageCode;
  nativeLabel: string;
  secondaryLabel: string;
  locale: string;
}

interface FeedbackState {
  kind: FeedbackKind;
  title: string;
  message: string;
  stamp: string;
}

interface CurrentPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface TranslationPack {
  stepLanguage: string;
  stepPin: string;
  stepLocation: string;
  headline: string;
  subtitle: string;
  back: string;
  pinLabel: string;
  pinPlaceholder: string;
  keypadHint: string;
  zoneAllowed: string;
  zoneRestriction: string;
  refreshGps: string;
  submit: string;
  processing: string;
  clear: string;
  erase: string;
  enterTitle: string;
  exitTitle: string;
  errorTitle: string;
  invalidPin: string;
  genericError: string;
  gpsLoadingBadge: string;
  gpsLoadingTitle: string;
  gpsLoadingDetail: string;
  gpsInsideBadge: string;
  gpsInsideTitle: string;
  gpsInsideDetail: string;
  gpsOutsideBadge: string;
  gpsOutsideTitle: string;
  gpsOutsideDetail: string;
  gpsDeniedBadge: string;
  gpsDeniedTitle: string;
  gpsDeniedDetail: string;
  gpsUnsupportedBadge: string;
  gpsUnsupportedTitle: string;
  gpsUnsupportedDetail: string;
  gpsErrorBadge: string;
  gpsErrorTitle: string;
  gpsErrorDetail: string;
  zoneLegend: string;
  youLegend: string;
  adminZoneLabel: string;
  zoneCenterLabel: string;
  yourPositionLabel: string;
  accuracyLabel: (meters: number) => string;
  successEnter: (name: string) => string;
  successExit: (name: string) => string;
  processedAt: (time: string) => string;
}

@Component({
  selector: 'app-clockinandout',
  templateUrl: './clockinandout.component.html',
  styleUrls: ['./clockinandout.component.css']
})
export class ClockinandoutComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pinInput') pinInput?: ElementRef<HTMLInputElement>;
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  readonly languages: LanguageOption[] = [
    { code: 'ro', nativeLabel: 'Romana', secondaryLabel: 'Romanian', locale: 'ro-RO' },
    { code: 'en', nativeLabel: 'English', secondaryLabel: 'English', locale: 'en-GB' },
    { code: 'pa', nativeLabel: 'ਪੰਜਾਬੀ', secondaryLabel: 'Punjabi', locale: 'pa-IN' },
    { code: 'hi', nativeLabel: 'हिन्दी', secondaryLabel: 'Hindi', locale: 'hi-IN' },
    { code: 'ne', nativeLabel: 'नेपाली', secondaryLabel: 'Nepali', locale: 'ne-NP' }
  ];

  readonly keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  readonly translations: Record<LanguageCode, TranslationPack> = {
    ro: {
      stepLanguage: 'Alege limba',
      stepPin: 'Introduceti PIN-ul',
      stepLocation: 'Locatie GPS',
      headline: 'Pontaj manual',
      subtitle: 'Fiecare angajat isi poate face pontajul de pe telefon. Check-in-ul este permis doar in zona stabilita de administrator.',
      back: 'Inapoi la pontaj',
      pinLabel: 'Introduceti PIN-ul',
      pinPlaceholder: 'PIN angajat',
      keypadHint: 'Poti folosi tastatura sau butoanele numerice.',
      zoneAllowed: 'Esti in zona selectata. Poti face check-in.',
      zoneRestriction: 'Check-in-ul este blocat pana intri in patratul verde.',
      refreshGps: 'Actualizeaza GPS',
      submit: 'Check in / Check out',
      processing: 'Se proceseaza...',
      clear: 'Sterge',
      erase: 'Inapoi',
      enterTitle: 'Pontare reusita',
      exitTitle: 'Depontare reusita',
      errorTitle: 'Actiune blocata',
      invalidPin: 'Nu am gasit niciun angajat cu acest PIN.',
      genericError: 'Nu am putut inregistra pontajul acum. Incearca din nou.',
      gpsLoadingBadge: 'GPS se conecteaza',
      gpsLoadingTitle: 'Cerem pozitia curenta a telefonului.',
      gpsLoadingDetail: 'Accepta accesul la locatie pentru a vedea daca esti in zona verde.',
      gpsInsideBadge: 'Esti in perimetru',
      gpsInsideTitle: 'Pozitia ta este in patratul selectat de administrator.',
      gpsInsideDetail: 'Poti trimite check-in-ul imediat.',
      gpsOutsideBadge: 'Esti in afara',
      gpsOutsideTitle: 'Pozitia ta nu este in patratul verde.',
      gpsOutsideDetail: 'Mergi in zona marcata pe harta pentru a activa butonul.',
      gpsDeniedBadge: 'GPS dezactivat',
      gpsDeniedTitle: 'Nu avem permisiune pentru localizare.',
      gpsDeniedDetail: 'Activeaza locatia in browserul telefonului si apasa din nou pe Actualizeaza GPS.',
      gpsUnsupportedBadge: 'GPS indisponibil',
      gpsUnsupportedTitle: 'Dispozitivul sau browserul nu suporta geolocatia.',
      gpsUnsupportedDetail: 'Pagina de check-in trebuie deschisa intr-un browser modern de pe telefon.',
      gpsErrorBadge: 'GPS instabil',
      gpsErrorTitle: 'Nu am reusit sa citesc pozitia curenta.',
      gpsErrorDetail: 'Verifica semnalul GPS si incearca din nou.',
      zoneLegend: 'Zona aprobata',
      youLegend: 'Pozitia mea',
      adminZoneLabel: 'Zona demo admin',
      zoneCenterLabel: 'Centru zona',
      yourPositionLabel: 'Pozitia ta',
      accuracyLabel: (meters: number) => `Acuratete GPS: aproximativ ${Math.round(meters)} m`,
      successEnter: (name: string) => `${name}, te-ai pontat cu succes.`,
      successExit: (name: string) => `${name}, te-ai depontat cu succes.`,
      processedAt: (time: string) => `Inregistrat la ${time}`
    },
    en: {
      stepLanguage: 'Choose language',
      stepPin: 'Enter PIN',
      stepLocation: 'GPS location',
      headline: 'Manual attendance',
      subtitle: 'Each employee can clock in from their own phone. Check-in is allowed only inside the area selected by the administrator.',
      back: 'Back to attendance',
      pinLabel: 'Enter PIN',
      pinPlaceholder: 'Employee PIN',
      keypadHint: 'You can use the keyboard or the numeric keypad.',
      zoneAllowed: 'You are inside the selected area. Check-in is enabled.',
      zoneRestriction: 'Check-in is blocked until you enter the green square.',
      refreshGps: 'Refresh GPS',
      submit: 'Check in / Check out',
      processing: 'Processing...',
      clear: 'Clear',
      erase: 'Back',
      enterTitle: 'Clock-in recorded',
      exitTitle: 'Clock-out recorded',
      errorTitle: 'Action blocked',
      invalidPin: 'No employee was found with this PIN.',
      genericError: 'The attendance could not be recorded right now. Please try again.',
      gpsLoadingBadge: 'GPS loading',
      gpsLoadingTitle: 'We are requesting the current phone location.',
      gpsLoadingDetail: 'Allow location access to check whether you are inside the green area.',
      gpsInsideBadge: 'Inside the zone',
      gpsInsideTitle: 'Your location is inside the area selected by the administrator.',
      gpsInsideDetail: 'You can submit the check-in now.',
      gpsOutsideBadge: 'Outside the zone',
      gpsOutsideTitle: 'Your location is outside the green square.',
      gpsOutsideDetail: 'Move into the marked area on the map to enable the button.',
      gpsDeniedBadge: 'GPS blocked',
      gpsDeniedTitle: 'We do not have permission to access location.',
      gpsDeniedDetail: 'Enable location in the phone browser and press Refresh GPS again.',
      gpsUnsupportedBadge: 'GPS unavailable',
      gpsUnsupportedTitle: 'This device or browser does not support geolocation.',
      gpsUnsupportedDetail: 'Open the check-in page in a modern browser on the phone.',
      gpsErrorBadge: 'GPS unstable',
      gpsErrorTitle: 'We could not read the current position.',
      gpsErrorDetail: 'Check GPS signal and try again.',
      zoneLegend: 'Allowed area',
      youLegend: 'My position',
      adminZoneLabel: 'Admin demo area',
      zoneCenterLabel: 'Zone center',
      yourPositionLabel: 'Your position',
      accuracyLabel: (meters: number) => `GPS accuracy: about ${Math.round(meters)} m`,
      successEnter: (name: string) => `${name}, you have clocked in successfully.`,
      successExit: (name: string) => `${name}, you have clocked out successfully.`,
      processedAt: (time: string) => `Recorded at ${time}`
    },
    pa: {
      stepLanguage: 'ਭਾਸ਼ਾ ਚੁਣੋ',
      stepPin: 'ਪਿੰਨ ਦਾਖਲ ਕਰੋ',
      stepLocation: 'GPS ਥਾਂ',
      headline: 'ਮੈਨੁਅਲ ਹਾਜ਼ਰੀ',
      subtitle: 'ਹਰ ਕਰਮਚਾਰੀ ਆਪਣੇ ਫੋਨ ਤੋਂ ਹਾਜ਼ਰੀ ਲਗਾ ਸਕਦਾ ਹੈ। ਚੈਕ-ਇਨ ਸਿਰਫ਼ ਐਡਮਿਨ ਵਾਲੀ ਚੁਣੀ ਹੋਈ ਜਗ੍ਹਾ ਅੰਦਰ ਹੀ ਹੋਵੇਗਾ।',
      back: 'ਹਾਜ਼ਰੀ ਵੱਲ ਵਾਪਸ',
      pinLabel: 'ਪਿੰਨ ਦਾਖਲ ਕਰੋ',
      pinPlaceholder: 'ਕਰਮਚਾਰੀ ਪਿੰਨ',
      keypadHint: 'ਤੁਸੀਂ ਕੀਬੋਰਡ ਜਾਂ ਨੰਬਰ ਬਟਨ ਵਰਤ ਸਕਦੇ ਹੋ।',
      zoneAllowed: 'ਤੁਸੀਂ ਚੁਣੀ ਹੋਈ ਜ਼ੋਨ ਵਿੱਚ ਹੋ। ਚੈਕ-ਇਨ ਚਾਲੂ ਹੈ।',
      zoneRestriction: 'ਜਦ ਤੱਕ ਤੁਸੀਂ ਹਰੇ ਵਰਗ ਵਿੱਚ ਨਹੀਂ ਆਉਂਦੇ, ਚੈਕ-ਇਨ ਬੰਦ ਰਹੇਗਾ।',
      refreshGps: 'GPS ਤਾਜ਼ਾ ਕਰੋ',
      submit: 'ਚੈਕ ਇਨ / ਚੈਕ ਆਉਟ',
      processing: 'ਕਾਰਵਾਈ ਜਾਰੀ ਹੈ...',
      clear: 'ਸਾਫ਼ ਕਰੋ',
      erase: 'ਵਾਪਸ',
      enterTitle: 'ਐਂਟਰੀ ਦਰਜ ਹੋਈ',
      exitTitle: 'ਐਗਜ਼ਿਟ ਦਰਜ ਹੋਈ',
      errorTitle: 'ਕਾਰਵਾਈ ਰੋਕੀ ਗਈ',
      invalidPin: 'ਇਸ ਪਿੰਨ ਨਾਲ ਕੋਈ ਕਰਮਚਾਰੀ ਨਹੀਂ ਮਿਲਿਆ।',
      genericError: 'ਇਸ ਵੇਲੇ ਹਾਜ਼ਰੀ ਦਰਜ ਨਹੀਂ ਹੋ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
      gpsLoadingBadge: 'GPS ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ',
      gpsLoadingTitle: 'ਫੋਨ ਦੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਲਈ ਬੇਨਤੀ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ।',
      gpsLoadingDetail: 'ਹਰੇ ਇਲਾਕੇ ਵਿੱਚ ਹੋ ਜਾਂ ਨਹੀਂ ਵੇਖਣ ਲਈ ਲੋਕੇਸ਼ਨ ਦੀ ਆਗਿਆ ਦਿਓ।',
      gpsInsideBadge: 'ਜ਼ੋਨ ਅੰਦਰ',
      gpsInsideTitle: 'ਤੁਹਾਡੀ ਲੋਕੇਸ਼ਨ ਐਡਮਿਨ ਵਾਲੀ ਚੁਣੀ ਜ਼ੋਨ ਅੰਦਰ ਹੈ।',
      gpsInsideDetail: 'ਹੁਣ ਤੁਸੀਂ ਚੈਕ-ਇਨ ਭੇਜ ਸਕਦੇ ਹੋ।',
      gpsOutsideBadge: 'ਜ਼ੋਨ ਤੋਂ ਬਾਹਰ',
      gpsOutsideTitle: 'ਤੁਹਾਡੀ ਲੋਕੇਸ਼ਨ ਹਰੇ ਵਰਗ ਤੋਂ ਬਾਹਰ ਹੈ।',
      gpsOutsideDetail: 'ਬਟਨ ਚਾਲੂ ਕਰਨ ਲਈ ਹਾਰਟੇ ਵਾਲੇ ਇਲਾਕੇ ਵਿੱਚ ਜਾਓ।',
      gpsDeniedBadge: 'GPS ਬੰਦ',
      gpsDeniedTitle: 'ਸਾਨੂੰ ਲੋਕੇਸ਼ਨ ਦੀ ਆਗਿਆ ਨਹੀਂ ਮਿਲੀ।',
      gpsDeniedDetail: 'ਫੋਨ ਦੇ ਬਰਾਊਜ਼ਰ ਵਿੱਚ ਲੋਕੇਸ਼ਨ ਚਾਲੂ ਕਰੋ ਅਤੇ ਦੁਬਾਰਾ GPS ਤਾਜ਼ਾ ਕਰੋ ਦਬਾਓ।',
      gpsUnsupportedBadge: 'GPS ਉਪਲਬਧ ਨਹੀਂ',
      gpsUnsupportedTitle: 'ਇਹ ਡਿਵਾਈਸ ਜਾਂ ਬਰਾਊਜ਼ਰ ਜਿਓਲੋਕੇਸ਼ਨ ਸਹਾਇਤਾ ਨਹੀਂ ਕਰਦਾ।',
      gpsUnsupportedDetail: 'ਚੈਕ-ਇਨ ਸਫ਼ਾ ਫੋਨ ਦੇ ਆਧੁਨਿਕ ਬਰਾਊਜ਼ਰ ਵਿੱਚ ਖੋਲ੍ਹੋ।',
      gpsErrorBadge: 'GPS ਅਸਥਿਰ',
      gpsErrorTitle: 'ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਨਹੀਂ ਪੜ੍ਹੀ ਜਾ ਸਕੀ।',
      gpsErrorDetail: 'GPS ਸਿਗਨਲ ਚੈਕ ਕਰੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
      zoneLegend: 'ਮੰਜ਼ੂਰ ਜ਼ੋਨ',
      youLegend: 'ਮੇਰੀ ਲੋਕੇਸ਼ਨ',
      adminZoneLabel: 'ਐਡਮਿਨ ਡੈਮੋ ਜ਼ੋਨ',
      zoneCenterLabel: 'ਜ਼ੋਨ ਕੇਂਦਰ',
      yourPositionLabel: 'ਤੁਹਾਡੀ ਲੋਕੇਸ਼ਨ',
      accuracyLabel: (meters: number) => `GPS ਸਹੀਪਨ: ਲਗਭਗ ${Math.round(meters)} ਮੀਟਰ`,
      successEnter: (name: string) => `${name}, ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਸਫਲਤਾਪੂਰਵਕ ਦਰਜ ਹੋ ਗਈ ਹੈ।`,
      successExit: (name: string) => `${name}, ਤੁਹਾਡੀ ਐਗਜ਼ਿਟ ਸਫਲਤਾਪੂਰਵਕ ਦਰਜ ਹੋ ਗਈ ਹੈ।`,
      processedAt: (time: string) => `${time} ਤੇ ਦਰਜ ਕੀਤਾ ਗਿਆ`
    },
    hi: {
      stepLanguage: 'भाषा चुनें',
      stepPin: 'पिन दर्ज करें',
      stepLocation: 'GPS स्थान',
      headline: 'मैनुअल उपस्थिति',
      subtitle: 'हर कर्मचारी अपने फोन से उपस्थिति दर्ज कर सकता है। चेक-इन केवल एडमिन द्वारा चुने गए क्षेत्र के अंदर ही होगा।',
      back: 'उपस्थिति पर वापस जाएं',
      pinLabel: 'पिन दर्ज करें',
      pinPlaceholder: 'कर्मचारी पिन',
      keypadHint: 'आप कीबोर्ड या नंबर बटन दोनों का उपयोग कर सकते हैं।',
      zoneAllowed: 'आप चुने हुए क्षेत्र के अंदर हैं। चेक-इन चालू है।',
      zoneRestriction: 'जब तक आप हरे वर्ग के अंदर नहीं आते, चेक-इन बंद रहेगा।',
      refreshGps: 'GPS रीफ्रेश करें',
      submit: 'चेक इन / चेक आउट',
      processing: 'प्रोसेस हो रहा है...',
      clear: 'साफ करें',
      erase: 'पीछे',
      enterTitle: 'एंट्री दर्ज हुई',
      exitTitle: 'एग्जिट दर्ज हुई',
      errorTitle: 'कार्रवाई रोकी गई',
      invalidPin: 'इस पिन से कोई कर्मचारी नहीं मिला।',
      genericError: 'अभी उपस्थिति दर्ज नहीं हो सकी। कृपया फिर से प्रयास करें।',
      gpsLoadingBadge: 'GPS लोड हो रहा है',
      gpsLoadingTitle: 'फोन की वर्तमान लोकेशन ली जा रही है।',
      gpsLoadingDetail: 'यह देखने के लिए लोकेशन अनुमति दें कि आप हरे क्षेत्र में हैं या नहीं।',
      gpsInsideBadge: 'क्षेत्र के अंदर',
      gpsInsideTitle: 'आपकी लोकेशन एडमिन द्वारा चुने गए क्षेत्र के अंदर है।',
      gpsInsideDetail: 'अब आप चेक-इन भेज सकते हैं।',
      gpsOutsideBadge: 'क्षेत्र के बाहर',
      gpsOutsideTitle: 'आपकी लोकेशन हरे वर्ग के बाहर है।',
      gpsOutsideDetail: 'बटन चालू करने के लिए नक्शे पर दिखाए गए क्षेत्र में जाएं।',
      gpsDeniedBadge: 'GPS बंद',
      gpsDeniedTitle: 'हमें लोकेशन की अनुमति नहीं मिली।',
      gpsDeniedDetail: 'फोन ब्राउज़र में लोकेशन चालू करें और फिर GPS रीफ्रेश करें।',
      gpsUnsupportedBadge: 'GPS उपलब्ध नहीं',
      gpsUnsupportedTitle: 'यह डिवाइस या ब्राउज़र जियोलोकेशन को सपोर्ट नहीं करता।',
      gpsUnsupportedDetail: 'चेक-इन पेज को फोन के आधुनिक ब्राउज़र में खोलें।',
      gpsErrorBadge: 'GPS अस्थिर',
      gpsErrorTitle: 'वर्तमान लोकेशन नहीं पढ़ी जा सकी।',
      gpsErrorDetail: 'GPS सिग्नल जांचें और फिर से प्रयास करें।',
      zoneLegend: 'अनुमोदित क्षेत्र',
      youLegend: 'मेरी लोकेशन',
      adminZoneLabel: 'एडमिन डेमो क्षेत्र',
      zoneCenterLabel: 'क्षेत्र केंद्र',
      yourPositionLabel: 'आपकी लोकेशन',
      accuracyLabel: (meters: number) => `GPS सटीकता: लगभग ${Math.round(meters)} मीटर`,
      successEnter: (name: string) => `${name}, आपकी एंट्री सफलतापूर्वक दर्ज हो गई है।`,
      successExit: (name: string) => `${name}, आपकी एग्जिट सफलतापूर्वक दर्ज हो गई है।`,
      processedAt: (time: string) => `${time} पर दर्ज किया गया`
    },
    ne: {
      stepLanguage: 'भाषा छान्नुहोस्',
      stepPin: 'पिन हाल्नुहोस्',
      stepLocation: 'GPS स्थान',
      headline: 'म्यानुअल हाजिरी',
      subtitle: 'हरेक कर्मचारीले आफ्नो फोनबाट हाजिरी गर्न सक्छ। चेक-इन एडमिनले छानेको क्षेत्रभित्र मात्र मान्य हुन्छ।',
      back: 'हाजिरीमा फर्कनुहोस्',
      pinLabel: 'पिन हाल्नुहोस्',
      pinPlaceholder: 'कर्मचारी पिन',
      keypadHint: 'किबोर्ड वा अंक बटन दुवै प्रयोग गर्न सकिन्छ।',
      zoneAllowed: 'तपाईं चयन गरिएको क्षेत्रमा हुनुहुन्छ। चेक-इन खुला छ।',
      zoneRestriction: 'तपाईं हरियो चौकोनभित्र नआएसम्म चेक-इन बन्द रहनेछ।',
      refreshGps: 'GPS फेरि जाँच्नुहोस्',
      submit: 'चेक इन / चेक आउट',
      processing: 'प्रक्रिया हुँदैछ...',
      clear: 'खाली गर्नुहोस्',
      erase: 'फर्कनुहोस्',
      enterTitle: 'प्रवेश दर्ता भयो',
      exitTitle: 'बहिर्गमन दर्ता भयो',
      errorTitle: 'कार्य रोकिनेछ',
      invalidPin: 'यो पिन भएका कर्मचारी भेटिएनन्।',
      genericError: 'अहिले हाजिरी दर्ता गर्न सकिएन। फेरि प्रयास गर्नुहोस्।',
      gpsLoadingBadge: 'GPS लोड हुँदैछ',
      gpsLoadingTitle: 'फोनको हालको स्थान मागिँदैछ।',
      gpsLoadingDetail: 'तपाईं हरियो क्षेत्रमा हुनुहुन्छ कि छैन भनेर हेर्न स्थान अनुमति दिनुहोस्।',
      gpsInsideBadge: 'क्षेत्रभित्र',
      gpsInsideTitle: 'तपाईंको स्थान एडमिनले छानेको क्षेत्रभित्र छ।',
      gpsInsideDetail: 'अब तपाईं चेक-इन पठाउन सक्नुहुन्छ।',
      gpsOutsideBadge: 'क्षेत्र बाहिर',
      gpsOutsideTitle: 'तपाईंको स्थान हरियो चौकोन बाहिर छ।',
      gpsOutsideDetail: 'बटन सक्रिय गर्न नक्शामा देखाइएको क्षेत्रमा जानुहोस्।',
      gpsDeniedBadge: 'GPS बन्द',
      gpsDeniedTitle: 'हामीलाई स्थान अनुमति छैन।',
      gpsDeniedDetail: 'फोन ब्राउजरमा स्थान अनुमति दिनुहोस् र फेरि GPS थिच्नुहोस्।',
      gpsUnsupportedBadge: 'GPS उपलब्ध छैन',
      gpsUnsupportedTitle: 'यो उपकरण वा ब्राउजरले जिओलोकेसन समर्थन गर्दैन।',
      gpsUnsupportedDetail: 'चेक-इन पृष्ठ फोनको आधुनिक ब्राउजरमा खोल्नुहोस्।',
      gpsErrorBadge: 'GPS अस्थिर',
      gpsErrorTitle: 'हालको स्थान पढ्न सकिएन।',
      gpsErrorDetail: 'GPS सिग्नल जाँच्नुहोस् र फेरि प्रयास गर्नुहोस्।',
      zoneLegend: 'अनुमत क्षेत्र',
      youLegend: 'मेरो स्थान',
      adminZoneLabel: 'एडमिन डेमो क्षेत्र',
      zoneCenterLabel: 'क्षेत्रको केन्द्र',
      yourPositionLabel: 'तपाईंको स्थान',
      accuracyLabel: (meters: number) => `GPS शुद्धता: लगभग ${Math.round(meters)} मिटर`,
      successEnter: (name: string) => `${name}, तपाईंको प्रवेश सफलतापूर्वक दर्ता भयो।`,
      successExit: (name: string) => `${name}, तपाईंको बहिर्गमन सफलतापूर्वक दर्ता भयो।`,
      processedAt: (time: string) => `${time} मा दर्ता गरियो`
    }
  };

  // Demo zone centered on the official Lake Home / Lacul lui Binder stop published by Sibiu City Hall.
  readonly adminZone = {
    name: 'Sibiu - Tractorului / Lacul lui Binder',
    center: { lat: 45.808853, lng: 24.131493 },
    sideMeters: 420
  };

  readonly zoneBounds = this.createSquareBounds(this.adminZone.center, this.adminZone.sideMeters);

  selectedLanguage: LanguageCode = this.readSavedLanguage();
  pin = '';
  submitting = false;
  currentTime = new Date();
  feedback: FeedbackState | null = null;
  currentPosition: CurrentPosition | null = null;
  locationState: LocationState = 'loading';

  private map: L.Map | null = null;
  private zoneRectangle: L.Rectangle | null = null;
  private zoneCenterMarker: L.CircleMarker | null = null;
  private userMarker: L.CircleMarker | null = null;
  private accuracyCircle: L.Circle | null = null;
  private watchId: number | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private hasFocusedMap = false;

  constructor(private api: SharedService, private router: Router) {}

  ngOnInit(): void {
    this.clockTimer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.startGeolocation();
    this.focusPinInput();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.stopGeolocation();
    this.map?.remove();
  }

  get t(): TranslationPack {
    return this.translations[this.selectedLanguage];
  }

  get formattedDate(): string {
    return new Intl.DateTimeFormat(this.currentLocale, {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(this.currentTime);
  }

  get formattedTime(): string {
    return new Intl.DateTimeFormat(this.currentLocale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(this.currentTime);
  }

  get currentLocale(): string {
    return this.languages.find((language) => language.code === this.selectedLanguage)?.locale ?? 'ro-RO';
  }

  get canSubmit(): boolean {
    return !!this.pin.trim() && this.locationState === 'inside' && !this.submitting;
  }

  get locationBadge(): string {
    return {
      loading: this.t.gpsLoadingBadge,
      inside: this.t.gpsInsideBadge,
      outside: this.t.gpsOutsideBadge,
      denied: this.t.gpsDeniedBadge,
      unsupported: this.t.gpsUnsupportedBadge,
      error: this.t.gpsErrorBadge
    }[this.locationState];
  }

  get locationTitle(): string {
    return {
      loading: this.t.gpsLoadingTitle,
      inside: this.t.gpsInsideTitle,
      outside: this.t.gpsOutsideTitle,
      denied: this.t.gpsDeniedTitle,
      unsupported: this.t.gpsUnsupportedTitle,
      error: this.t.gpsErrorTitle
    }[this.locationState];
  }

  get locationDetail(): string {
    return {
      loading: this.t.gpsLoadingDetail,
      inside: this.t.gpsInsideDetail,
      outside: this.t.gpsOutsideDetail,
      denied: this.t.gpsDeniedDetail,
      unsupported: this.t.gpsUnsupportedDetail,
      error: this.t.gpsErrorDetail
    }[this.locationState];
  }

  setLanguage(code: LanguageCode): void {
    this.selectedLanguage = code;
    localStorage.setItem('clockinandout-language', code);
    this.focusPinInput();
  }

  updatePin(value: string): void {
    this.pin = value.replace(/\D/g, '').slice(0, 12);
  }

  appendDigit(digit: string): void {
    if (this.submitting || this.pin.length >= 12) {
      return;
    }

    this.pin = `${this.pin}${digit}`;
    this.focusPinInput();
  }

  clearPin(): void {
    this.pin = '';
    this.focusPinInput();
  }

  eraseLast(): void {
    if (!this.pin) {
      return;
    }

    this.pin = this.pin.slice(0, -1);
    this.focusPinInput();
  }

  refreshLocation(): void {
    this.startGeolocation();
  }

  submitPin(): void {
    if (!this.canSubmit) {
      this.showError(this.t.zoneRestriction);
      return;
    }

    const cleanPin = this.pin.trim();
    this.submitting = true;

    this.api.manualAttendanceByPin(cleanPin, this.adminZone.name).subscribe({
      next: (response) => {
        this.submitting = false;

        if (response?.debounced) {
          return;
        }

        if (!response?.user?.name || !response?.state) {
          this.showError(this.t.invalidPin);
          this.clearPin();
          return;
        }

        this.showAttendanceFeedback(response.state, response.user.name);
        this.clearPin();
      },
      error: (error) => {
        this.submitting = false;
        const message = typeof error?.error?.error === 'string' ? error.error.error : this.t.genericError;
        this.showError(message);
        this.clearPin();
      }
    });
  }

  backToPontaj(): void {
    this.router.navigate(['/pontaj']);
  }

  formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  private showAttendanceFeedback(state: AttendanceState, userName: string): void {
    if (state === 'ENTER') {
      this.feedback = {
        kind: 'enter',
        title: this.t.enterTitle,
        message: this.t.successEnter(userName),
        stamp: this.t.processedAt(this.formattedTime)
      };
    } else {
      this.feedback = {
        kind: 'exit',
        title: this.t.exitTitle,
        message: this.t.successExit(userName),
        stamp: this.t.processedAt(this.formattedTime)
      };
    }

    this.scheduleFeedbackReset();
    this.focusPinInput();
  }

  private showError(message: string): void {
    this.feedback = {
      kind: 'error',
      title: this.t.errorTitle,
      message,
      stamp: this.t.processedAt(this.formattedTime)
    };

    this.scheduleFeedbackReset();
    this.focusPinInput();
  }

  private scheduleFeedbackReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      this.feedback = null;
    }, 7000);
  }

  private initMap(): void {
    if (!this.mapContainer) {
      return;
    }

    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.zoneRectangle = L.rectangle(
      [
        [this.zoneBounds.south, this.zoneBounds.west],
        [this.zoneBounds.north, this.zoneBounds.east]
      ],
      {
        color: '#0f766e',
        weight: 2,
        fillColor: '#0f766e',
        fillOpacity: 0.14
      }
    ).addTo(this.map);

    this.zoneCenterMarker = L.circleMarker([this.adminZone.center.lat, this.adminZone.center.lng], {
      radius: 7,
      color: '#0f766e',
      weight: 2,
      fillColor: '#f8fafc',
      fillOpacity: 1
    }).addTo(this.map);

    this.zoneCenterMarker.bindTooltip(this.adminZone.name, {
      permanent: false,
      direction: 'top'
    });

    this.map.fitBounds(this.zoneRectangle.getBounds().pad(0.35), { maxZoom: 17 });
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private startGeolocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.locationState = 'unsupported';
      return;
    }

    this.stopGeolocation();
    this.locationState = 'loading';

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePosition(position),
      (error) => this.handlePositionError(error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  }

  private stopGeolocation(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private handlePosition(position: GeolocationPosition): void {
    this.currentPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };

    this.locationState = this.pointInsideSquare(this.currentPosition.lat, this.currentPosition.lng) ? 'inside' : 'outside';
    this.updateUserLayers();
  }

  private handlePositionError(error: GeolocationPositionError): void {
    if (error.code === error.PERMISSION_DENIED) {
      this.locationState = 'denied';
      return;
    }

    this.locationState = 'error';
  }

  private updateUserLayers(): void {
    if (!this.map || !this.currentPosition) {
      return;
    }

    const inside = this.locationState === 'inside';
    const color = inside ? '#0f766e' : '#d97706';
    const latLng = L.latLng(this.currentPosition.lat, this.currentPosition.lng);

    if (!this.userMarker) {
      this.userMarker = L.circleMarker(latLng, {
        radius: 9,
        color,
        weight: 3,
        fillColor: color,
        fillOpacity: 0.95
      }).addTo(this.map);
    } else {
      this.userMarker.setLatLng(latLng);
      this.userMarker.setStyle({ color, fillColor: color });
    }

    if (!this.accuracyCircle) {
      this.accuracyCircle = L.circle(latLng, {
        radius: this.currentPosition.accuracy,
        color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.08
      }).addTo(this.map);
    } else {
      this.accuracyCircle.setLatLng(latLng);
      this.accuracyCircle.setRadius(this.currentPosition.accuracy);
      this.accuracyCircle.setStyle({ color, fillColor: color });
    }

    if (!this.hasFocusedMap && this.zoneRectangle) {
      const combinedBounds = this.zoneRectangle.getBounds().extend(latLng).pad(0.2);
      this.map.fitBounds(combinedBounds, { maxZoom: 17 });
      this.hasFocusedMap = true;
    }
  }

  private pointInsideSquare(lat: number, lng: number): boolean {
    return lat >= this.zoneBounds.south &&
      lat <= this.zoneBounds.north &&
      lng >= this.zoneBounds.west &&
      lng <= this.zoneBounds.east;
  }

  private createSquareBounds(center: { lat: number; lng: number }, sideMeters: number): MapBounds {
    const halfSide = sideMeters / 2;
    const latDelta = halfSide / 111320;
    const lngDelta = halfSide / (111320 * Math.cos(center.lat * Math.PI / 180));

    return {
      north: center.lat + latDelta,
      south: center.lat - latDelta,
      east: center.lng + lngDelta,
      west: center.lng - lngDelta
    };
  }

  private focusPinInput(): void {
    setTimeout(() => this.pinInput?.nativeElement.focus(), 0);
  }

  private readSavedLanguage(): LanguageCode {
    const saved = localStorage.getItem('clockinandout-language') as LanguageCode | null;
    if (saved && this.languages.some((language) => language.code === saved)) {
      return saved;
    }

    return 'ro';
  }
}
