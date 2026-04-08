import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { SharedService } from '../shared.service';

type LanguageCode = 'ro' | 'en' | 'pa' | 'hi' | 'ne';
type FeedbackKind = 'enter' | 'exit' | 'error';
type AttendanceState = 'ENTER' | 'EXIT';
type LocationState = 'idle' | 'loading' | 'inside' | 'outside' | 'expired' | 'denied' | 'unsupported' | 'error';
type WorksiteType = 'polygon' | 'circle';

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

interface WorksiteDefinition {
  name: string;
  type: WorksiteType;
  center: { lat: number; lng: number };
  polygon?: L.LatLngTuple[];
  radiusMeters?: number;
}

interface TranslationPack {
  stepLanguage: string;
  stepPin: string;
  stepLocation: string;
  headline: string;
  subtitle: string;
  worksiteLabel: string;
  worksitePlaceholder: string;
  worksiteHelper: string;
  worksiteRequired: string;
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
  manualDeviceLockedError: string;
  manualCheckoutSameDeviceError: string;
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
  selectedWorksiteLabel: string;
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
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  readonly languages: LanguageOption[] = [
    { code: 'ro', nativeLabel: 'Romana', secondaryLabel: 'Romanian', locale: 'ro-RO' },
    { code: 'en', nativeLabel: 'English', secondaryLabel: 'English', locale: 'en-GB' },
    { code: 'pa', nativeLabel: 'ਪੰਜਾਬੀ', secondaryLabel: 'Punjabi', locale: 'pa-IN' },
    { code: 'hi', nativeLabel: 'हिन्दी', secondaryLabel: 'Hindi', locale: 'hi-IN' },
    { code: 'ne', nativeLabel: 'नेपाली', secondaryLabel: 'Nepali', locale: 'ne-NP' }
  ];

  readonly sharedLakeHomeCenter = { lat: 45.81027575048179, lng: 24.130539205078342 };

  readonly worksites: WorksiteDefinition[] = [
    { name: 'The Lake Home Bloc A', type: 'circle', center: this.sharedLakeHomeCenter, radiusMeters: 4220 },
    { name: 'The Lake Home Bloc B2', type: 'circle', center: this.sharedLakeHomeCenter, radiusMeters: 40 },
    { name: 'The Lake Home Blocurile E si F', type: 'circle', center: this.sharedLakeHomeCenter, radiusMeters: 40 },
    { name: 'psihiatrie c8', type: 'circle', center: { lat: 45.80720228440877, lng: 24.15440514734915 }, radiusMeters: 40 },
    { name: 'psihiatrie c16', type: 'circle', center: { lat: 45.80768553302182, lng: 24.157085884823974 }, radiusMeters: 40 },
    { name: 'spital victoria', type: 'circle', center: { lat: 45.725861888407216, lng: 24.70584969156609 }, radiusMeters: 40 },
    { name: 'casa de cultura victoria', type: 'circle', center: { lat: 45.73050790281027, lng: 24.70109770865094 }, radiusMeters: 40 },
    { name: 'bazin ucea', type: 'circle', center: { lat: 45.70058115535115, lng: 24.689376326811146 }, radiusMeters: 40 },
    { name: 'bloc agnita', type: 'circle', center: { lat: 45.97724541353617, lng: 24.62272565333796 }, radiusMeters: 40 },
    { name: 'gradinita agnita', type: 'circle', center: { lat: 45.97789754940184, lng: 24.61674765866955 }, radiusMeters: 40 },
    { name: 'bloc 14 victoria', type: 'circle', center: { lat: 45.73336901742498, lng: 24.701707107591304 }, radiusMeters: 40 },
    { name: 'bloc 3 victoria', type: 'circle', center: { lat: 45.73105012404724, lng: 24.696154238062714 }, radiusMeters: 40 }
  ];

  readonly translations: Record<LanguageCode, TranslationPack> = {
    ro: {
      stepLanguage: 'Alege limba',
      stepPin: 'Introduceti PIN-ul',
      stepLocation: 'Locatie GPS',
      headline: 'Pontaj manual',
      subtitle: 'Alege limba:',
      worksiteLabel: 'Alege santierul',
      worksitePlaceholder: 'Alege santierul',
      worksiteHelper: 'Aici poti sa vezi locatia santierului si pozitia ta actuala in relatie cu santierul. S-ar putea sa fie nevoie sa te muti putin ca sa fii in interiorul locatiei de pontaj. Daca nu esti in interior, nu vei putea sa te pontezi.',
      worksiteRequired: 'Alege santierul.',
      pinLabel: 'Introduceti PIN-ul',
      pinPlaceholder: 'PIN angajat',
      keypadHint: 'Poti folosi tastatura sau butoanele numerice.',
      zoneAllowed: 'Esti in interiorul santierului selectat. Poti sa te pontezi.',
      zoneRestriction: 'Nu esti pe santier.',
      refreshGps: 'Ia-mi locatia mea live',
      submit: 'Check in / Check out',
      processing: 'Se proceseaza...',
      clear: 'Sterge',
      erase: 'Inapoi',
      enterTitle: 'Pontare reusita',
      exitTitle: 'Depontare reusita',
      errorTitle: 'Actiune blocata',
      invalidPin: 'Nu am gasit niciun angajat cu acest PIN.',
      genericError: 'Nu am putut inregistra pontajul acum. Incearca din nou.',
      manualDeviceLockedError: 'Telefonul sau browserul acesta are deja un check-in activ pentru alt muncitor. Pe acest dispozitiv poti face acum doar check-out pentru muncitorul pontat primul.',
      manualCheckoutSameDeviceError: 'Check-out-ul pentru acest muncitor trebuie facut de pe acelasi telefon sau browser folosit la check-in.',
      gpsLoadingBadge: 'GPS se conecteaza',
      gpsLoadingTitle: 'Cerem pozitia curenta a telefonului.',
      gpsLoadingDetail: 'Accepta accesul la locatie pentru a verifica daca esti in zona santierului.',
      gpsInsideBadge: 'Esti in perimetru',
      gpsInsideTitle: 'Pozitia ta este in interiorul santierului selectat.',
      gpsInsideDetail: 'Poti trimite check-in-ul imediat.',
      gpsOutsideBadge: 'Esti in afara',
      gpsOutsideTitle: 'Nu esti pe santier.',
      gpsOutsideDetail: 'Mergi in zona verde pentru a activa butonul.',
      gpsDeniedBadge: 'GPS dezactivat',
      gpsDeniedTitle: 'Nu avem permisiune pentru localizare.',
      gpsDeniedDetail: 'Activeaza locatia in browserul telefonului si apasa din nou pe Actualizeaza GPS.',
      gpsUnsupportedBadge: 'GPS indisponibil',
      gpsUnsupportedTitle: 'Dispozitivul sau browserul nu suporta geolocatia.',
      gpsUnsupportedDetail: 'Pagina de check-in trebuie deschisa intr-un browser modern de pe telefon.',
      gpsErrorBadge: 'GPS instabil',
      gpsErrorTitle: 'Nu am reusit sa citesc pozitia curenta.',
      gpsErrorDetail: 'Verifica semnalul GPS si incearca din nou.',
      zoneLegend: 'Zona santier',
      youLegend: 'Pozitia mea',
      selectedWorksiteLabel: 'Santier selectat',
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
      subtitle: 'Choose language:',
      worksiteLabel: 'Choose worksite',
      worksitePlaceholder: 'Choose worksite',
      worksiteHelper: 'Here you can see the worksite location and your current position in relation to the worksite. You may need to move a little to be inside the attendance area. If you are not inside, you will not be able to clock in.',
      worksiteRequired: 'Choose the worksite.',
      pinLabel: 'Enter PIN',
      pinPlaceholder: 'Employee PIN',
      keypadHint: 'You can use the keyboard or the numeric keypad.',
      zoneAllowed: 'You are inside the selected worksite. Check-in is enabled.',
      zoneRestriction: 'You are not on the worksite.',
      refreshGps: 'Get my live location',
      submit: 'Check in / Check out',
      processing: 'Processing...',
      clear: 'Clear',
      erase: 'Back',
      enterTitle: 'Clock-in recorded',
      exitTitle: 'Clock-out recorded',
      errorTitle: 'Action blocked',
      invalidPin: 'No employee was found with this PIN.',
      genericError: 'The attendance could not be recorded right now. Please try again.',
      manualDeviceLockedError: 'This phone or browser already has an active check-in for another worker. On this device you can only check out the worker who checked in first.',
      manualCheckoutSameDeviceError: 'Clock-out for this worker must be done from the same phone or browser used for clock-in.',
      gpsLoadingBadge: 'GPS loading',
      gpsLoadingTitle: 'We are requesting the current phone location.',
      gpsLoadingDetail: 'Allow location access to verify whether you are inside the worksite area.',
      gpsInsideBadge: 'Inside the area',
      gpsInsideTitle: 'Your location is inside the selected worksite.',
      gpsInsideDetail: 'You can submit the check-in now.',
      gpsOutsideBadge: 'Outside the area',
      gpsOutsideTitle: 'You are not on the worksite.',
      gpsOutsideDetail: 'Move into the green area to enable the button.',
      gpsDeniedBadge: 'GPS blocked',
      gpsDeniedTitle: 'We do not have permission to access location.',
      gpsDeniedDetail: 'Enable location in the phone browser and press Refresh GPS again.',
      gpsUnsupportedBadge: 'GPS unavailable',
      gpsUnsupportedTitle: 'This device or browser does not support geolocation.',
      gpsUnsupportedDetail: 'Open the check-in page in a modern browser on the phone.',
      gpsErrorBadge: 'GPS unstable',
      gpsErrorTitle: 'We could not read the current position.',
      gpsErrorDetail: 'Check GPS signal and try again.',
      zoneLegend: 'Worksite area',
      youLegend: 'My position',
      selectedWorksiteLabel: 'Selected worksite',
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
      subtitle: 'ਭਾਸ਼ਾ ਚੁਣੋ:',
      worksiteLabel: 'ਸਾਈਟ ਚੁਣੋ',
      worksitePlaceholder: 'ਸਾਈਟ ਚੁਣੋ',
      worksiteHelper: 'ਇੱਥੇ ਤੁਸੀਂ ਸਾਈਟ ਦੀ ਲੋਕੇਸ਼ਨ ਅਤੇ ਆਪਣੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਨੂੰ ਸਾਈਟ ਦੇ ਸਬੰਧ ਵਿੱਚ ਦੇਖ ਸਕਦੇ ਹੋ। ਹੋ ਸਕਦਾ ਹੈ ਤੁਹਾਨੂੰ ਥੋੜ੍ਹਾ ਜਿਹਾ ਹਿਲਣਾ ਪਵੇ ਤਾਂ ਜੋ ਤੁਸੀਂ ਹਾਜ਼ਰੀ ਵਾਲੀ ਜਗ੍ਹਾ ਦੇ ਅੰਦਰ ਆ ਜਾਓ। ਜੇ ਤੁਸੀਂ ਅੰਦਰ ਨਹੀਂ ਹੋ ਤਾਂ ਤੁਸੀਂ ਚੈਕ-ਇਨ ਨਹੀਂ ਕਰ ਸਕੋਗੇ।',
      worksiteRequired: 'ਸਾਈਟ ਚੁਣੋ।',
      pinLabel: 'ਪਿੰਨ ਦਾਖਲ ਕਰੋ',
      pinPlaceholder: 'ਕਰਮਚਾਰੀ ਪਿੰਨ',
      keypadHint: 'ਤੁਸੀਂ ਕੀਬੋਰਡ ਜਾਂ ਨੰਬਰ ਬਟਨ ਵਰਤ ਸਕਦੇ ਹੋ।',
      zoneAllowed: 'ਤੁਸੀਂ ਚੁਣੀ ਹੋਈ ਸਾਈਟ ਦੇ ਅੰਦਰ ਹੋ। ਚੈਕ-ਇਨ ਚਾਲੂ ਹੈ।',
      zoneRestriction: 'ਤੁਸੀਂ ਸਾਈਟ ਤੇ ਨਹੀਂ ਹੋ।',
      refreshGps: 'ਮੇਰੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਲਵੋ',
      submit: 'ਚੈਕ ਇਨ / ਚੈਕ ਆਉਟ',
      processing: 'ਕਾਰਵਾਈ ਜਾਰੀ ਹੈ...',
      clear: 'ਸਾਫ਼ ਕਰੋ',
      erase: 'ਵਾਪਸ',
      enterTitle: 'ਐਂਟਰੀ ਦਰਜ ਹੋਈ',
      exitTitle: 'ਐਗਜ਼ਿਟ ਦਰਜ ਹੋਈ',
      errorTitle: 'ਕਾਰਵਾਈ ਰੋਕੀ ਗਈ',
      invalidPin: 'ਇਸ ਪਿੰਨ ਨਾਲ ਕੋਈ ਕਰਮਚਾਰੀ ਨਹੀਂ ਮਿਲਿਆ।',
      genericError: 'ਇਸ ਵੇਲੇ ਹਾਜ਼ਰੀ ਦਰਜ ਨਹੀਂ ਹੋ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
      manualDeviceLockedError: 'ਇਸ ਫੋਨ ਜਾਂ ਬਰਾਊਜ਼ਰ ਤੋਂ ਪਹਿਲਾਂ ਹੀ ਕਿਸੇ ਹੋਰ ਮਜ਼ਦੂਰ ਦਾ ਚੈਕ-ਇਨ ਖੁੱਲ੍ਹਾ ਹੈ। ਇਸ ਡਿਵਾਈਸ ਤੋਂ ਹੁਣ ਸਿਰਫ਼ ਉਸੇ ਮਜ਼ਦੂਰ ਦਾ ਚੈਕ-ਆਉਟ ਹੋ ਸਕਦਾ ਹੈ।',
      manualCheckoutSameDeviceError: 'ਇਸ ਮਜ਼ਦੂਰ ਦਾ ਚੈਕ-ਆਉਟ ਉਸੇ ਫੋਨ ਜਾਂ ਬਰਾਊਜ਼ਰ ਤੋਂ ਕਰਨਾ ਪਵੇਗਾ ਜਿਸ ਨਾਲ ਚੈਕ-ਇਨ ਕੀਤਾ ਗਿਆ ਸੀ।',
      gpsLoadingBadge: 'GPS ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ',
      gpsLoadingTitle: 'ਫੋਨ ਦੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਲਈ ਬੇਨਤੀ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ।',
      gpsLoadingDetail: 'ਲੋਕੇਸ਼ਨ ਦੀ ਆਗਿਆ ਦਿਓ ਤਾਂ ਜੋ ਪਤਾ ਲੱਗੇ ਕਿ ਤੁਸੀਂ ਸਾਈਟ ਦੀ ਜ਼ੋਨ ਵਿੱਚ ਹੋ ਜਾਂ ਨਹੀਂ।',
      gpsInsideBadge: 'ਪੇਰੀਮੀਟਰ ਅੰਦਰ',
      gpsInsideTitle: 'ਤੁਹਾਡੀ ਲੋਕੇਸ਼ਨ ਚੁਣੀ ਹੋਈ ਸਾਈਟ ਦੇ ਅੰਦਰ ਹੈ।',
      gpsInsideDetail: 'ਹੁਣ ਤੁਸੀਂ ਚੈਕ-ਇਨ ਭੇਜ ਸਕਦੇ ਹੋ।',
      gpsOutsideBadge: 'ਪੇਰੀਮੀਟਰ ਤੋਂ ਬਾਹਰ',
      gpsOutsideTitle: 'ਤੁਸੀਂ ਸਾਈਟ ਤੇ ਨਹੀਂ ਹੋ।',
      gpsOutsideDetail: 'ਬਟਨ ਚਾਲੂ ਕਰਨ ਲਈ ਹਰੀ ਜ਼ੋਨ ਵਿੱਚ ਜਾਓ।',
      gpsDeniedBadge: 'GPS ਬੰਦ',
      gpsDeniedTitle: 'ਸਾਨੂੰ ਲੋਕੇਸ਼ਨ ਦੀ ਆਗਿਆ ਨਹੀਂ ਮਿਲੀ।',
      gpsDeniedDetail: 'ਫੋਨ ਦੇ ਬਰਾਊਜ਼ਰ ਵਿੱਚ ਲੋਕੇਸ਼ਨ ਚਾਲੂ ਕਰੋ ਅਤੇ ਦੁਬਾਰਾ GPS ਤਾਜ਼ਾ ਕਰੋ ਦਬਾਓ।',
      gpsUnsupportedBadge: 'GPS ਉਪਲਬਧ ਨਹੀਂ',
      gpsUnsupportedTitle: 'ਇਹ ਡਿਵਾਈਸ ਜਾਂ ਬਰਾਊਜ਼ਰ ਜਿਓਲੋਕੇਸ਼ਨ ਸਹਾਇਤਾ ਨਹੀਂ ਕਰਦਾ।',
      gpsUnsupportedDetail: 'ਚੈਕ-ਇਨ ਸਫ਼ਾ ਫੋਨ ਦੇ ਆਧੁਨਿਕ ਬਰਾਊਜ਼ਰ ਵਿੱਚ ਖੋਲ੍ਹੋ।',
      gpsErrorBadge: 'GPS ਅਸਥਿਰ',
      gpsErrorTitle: 'ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਨਹੀਂ ਪੜ੍ਹੀ ਜਾ ਸਕੀ।',
      gpsErrorDetail: 'GPS ਸਿਗਨਲ ਚੈਕ ਕਰੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
      zoneLegend: 'ਸਾਈਟ ਜ਼ੋਨ',
      youLegend: 'ਮੇਰੀ ਲੋਕੇਸ਼ਨ',
      selectedWorksiteLabel: 'ਚੁਣੀ ਹੋਈ ਸਾਈਟ',
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
      subtitle: 'भाषा चुनें:',
      worksiteLabel: 'साइट चुनें',
      worksitePlaceholder: 'साइट चुनें',
      worksiteHelper: 'यहां आप साइट की लोकेशन और अपनी वर्तमान लोकेशन को साइट के संबंध में देख सकते हैं। हो सकता है आपको थोड़ा हिलना पड़े ताकि आप उपस्थिति क्षेत्र के अंदर आ सकें। यदि आप अंदर नहीं हैं तो आप चेक-इन नहीं कर पाएंगे।',
      worksiteRequired: 'साइट चुनें।',
      pinLabel: 'पिन दर्ज करें',
      pinPlaceholder: 'कर्मचारी पिन',
      keypadHint: 'आप कीबोर्ड या नंबर बटन दोनों का उपयोग कर सकते हैं।',
      zoneAllowed: 'आप चुनी हुई साइट के अंदर हैं। चेक-इन चालू है।',
      zoneRestriction: 'आप साइट पर नहीं हैं।',
      refreshGps: 'मेरी लाइव लोकेशन लो',
      submit: 'चेक इन / चेक आउट',
      processing: 'प्रोसेस हो रहा है...',
      clear: 'साफ करें',
      erase: 'पीछे',
      enterTitle: 'एंट्री दर्ज हुई',
      exitTitle: 'एग्जिट दर्ज हुई',
      errorTitle: 'कार्रवाई रोकी गई',
      invalidPin: 'इस पिन से कोई कर्मचारी नहीं मिला।',
      genericError: 'अभी उपस्थिति दर्ज नहीं हो सकी। कृपया फिर से प्रयास करें।',
      manualDeviceLockedError: 'इस फोन या ब्राउज़र पर पहले से किसी दूसरे मजदूर का सक्रिय चेक-इन है। इस डिवाइस से अब केवल उसी मजदूर का चेक-आउट किया जा सकता है।',
      manualCheckoutSameDeviceError: 'इस मजदूर का चेक-आउट उसी फोन या ब्राउज़र से करना होगा जिससे चेक-इन किया गया था।',
      gpsLoadingBadge: 'GPS लोड हो रहा है',
      gpsLoadingTitle: 'फोन की वर्तमान लोकेशन ली जा रही है।',
      gpsLoadingDetail: 'यह देखने के लिए लोकेशन अनुमति दें कि आप साइट की ज़ोन में हैं या नहीं।',
      gpsInsideBadge: 'क्षेत्र के अंदर',
      gpsInsideTitle: 'आपकी लोकेशन चुनी हुई साइट के अंदर है।',
      gpsInsideDetail: 'अब आप चेक-इन भेज सकते हैं।',
      gpsOutsideBadge: 'क्षेत्र के बाहर',
      gpsOutsideTitle: 'आप साइट पर नहीं हैं।',
      gpsOutsideDetail: 'बटन चालू करने के लिए हरे क्षेत्र में जाएं।',
      gpsDeniedBadge: 'GPS बंद',
      gpsDeniedTitle: 'हमें लोकेशन की अनुमति नहीं मिली।',
      gpsDeniedDetail: 'फोन ब्राउज़र में लोकेशन चालू करें और फिर GPS रीफ्रेश करें।',
      gpsUnsupportedBadge: 'GPS उपलब्ध नहीं',
      gpsUnsupportedTitle: 'यह डिवाइस या ब्राउज़र जियोलोकेशन को सपोर्ट नहीं करता।',
      gpsUnsupportedDetail: 'चेक-इन पेज को फोन के आधुनिक ब्राउज़र में खोलें।',
      gpsErrorBadge: 'GPS अस्थिर',
      gpsErrorTitle: 'वर्तमान लोकेशन नहीं पढ़ी जा सकी।',
      gpsErrorDetail: 'GPS सिग्नल जांचें और फिर से प्रयास करें।',
      zoneLegend: 'साइट ज़ोन',
      youLegend: 'मेरी लोकेशन',
      selectedWorksiteLabel: 'चुनी हुई साइट',
      zoneCenterLabel: 'ज़ोन केंद्र',
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
      subtitle: 'भाषा छान्नुहोस्:',
      worksiteLabel: 'साइट छान्नुहोस्',
      worksitePlaceholder: 'साइट छान्नुहोस्',
      worksiteHelper: 'यहाँ तपाईंले साइटको स्थान र आफ्नो हालको स्थानलाई साइटसँग सम्बन्धित रूपमा देख्न सक्नुहुन्छ। तपाईंले हाजिरी गर्ने क्षेत्रभित्र पुग्न अलि सर्नु पर्ने हुन सक्छ। यदि तपाईं भित्र हुनुहुन्न भने तपाईंले चेक-इन गर्न सक्नुहुने छैन।',
      worksiteRequired: 'साइट छान्नुहोस्।',
      pinLabel: 'पिन हाल्नुहोस्',
      pinPlaceholder: 'कर्मचारी पिन',
      keypadHint: 'किबोर्ड वा अंक बटन दुवै प्रयोग गर्न सकिन्छ।',
      zoneAllowed: 'तपाईं चयन गरिएको साइटभित्र हुनुहुन्छ। चेक-इन खुला छ।',
      zoneRestriction: 'तपाईं साइटमा हुनुहुन्न।',
      refreshGps: 'मेरो हालको लोकेशन लिनुहोस्',
      submit: 'चेक इन / चेक आउट',
      processing: 'प्रक्रिया हुँदैछ...',
      clear: 'खाली गर्नुहोस्',
      erase: 'फर्कनुहोस्',
      enterTitle: 'प्रवेश दर्ता भयो',
      exitTitle: 'बहिर्गमन दर्ता भयो',
      errorTitle: 'कार्य रोकिनेछ',
      invalidPin: 'यो पिन भएका कर्मचारी भेटिएनन्।',
      genericError: 'अहिले हाजिरी दर्ता गर्न सकिएन। फेरि प्रयास गर्नुहोस्।',
      manualDeviceLockedError: 'यो फोन वा ब्राउजरमा पहिले नै अर्को कामदारको सक्रिय चेक-इन छ। यो डिभाइसबाट अब त्यही कामदारको चेक-आउट मात्र गर्न सकिन्छ।',
      manualCheckoutSameDeviceError: 'यो कामदारको चेक-आउट चेक-इन गरिएको त्यही फोन वा ब्राउजरबाट गर्नुपर्छ।',
      gpsLoadingBadge: 'GPS लोड हुँदैछ',
      gpsLoadingTitle: 'फोनको हालको स्थान मागिँदैछ।',
      gpsLoadingDetail: 'तपाईं साइटको क्षेत्रमा हुनुहुन्छ कि छैन भनेर हेर्न स्थान अनुमति दिनुहोस्।',
      gpsInsideBadge: 'परिधिभित्र',
      gpsInsideTitle: 'तपाईंको स्थान चयन गरिएको साइटभित्र छ।',
      gpsInsideDetail: 'अब तपाईं चेक-इन पठाउन सक्नुहुन्छ।',
      gpsOutsideBadge: 'परिधि बाहिर',
      gpsOutsideTitle: 'तपाईं साइटमा हुनुहुन्न।',
      gpsOutsideDetail: 'बटन सक्रिय गर्न हरियो क्षेत्रमा जानुहोस्।',
      gpsDeniedBadge: 'GPS बन्द',
      gpsDeniedTitle: 'हामीलाई स्थान अनुमति छैन।',
      gpsDeniedDetail: 'फोन ब्राउजरमा स्थान अनुमति दिनुहोस् र फेरि GPS थिच्नुहोस्।',
      gpsUnsupportedBadge: 'GPS उपलब्ध छैन',
      gpsUnsupportedTitle: 'यो उपकरण वा ब्राउजरले जिओलोकेसन समर्थन गर्दैन।',
      gpsUnsupportedDetail: 'चेक-इन पृष्ठ फोनको आधुनिक ब्राउजरमा खोल्नुहोस्।',
      gpsErrorBadge: 'GPS अस्थिर',
      gpsErrorTitle: 'हालको स्थान पढ्न सकिएन।',
      gpsErrorDetail: 'GPS सिग्नल जाँच्नुहोस् र फेरि प्रयास गर्नुहोस्।',
      zoneLegend: 'साइट क्षेत्र',
      youLegend: 'मेरो स्थान',
      selectedWorksiteLabel: 'चयन गरिएको साइट',
      zoneCenterLabel: 'क्षेत्रको केन्द्र',
      yourPositionLabel: 'तपाईंको स्थान',
      accuracyLabel: (meters: number) => `GPS शुद्धता: लगभग ${Math.round(meters)} मिटर`,
      successEnter: (name: string) => `${name}, तपाईंको प्रवेश सफलतापूर्वक दर्ता भयो।`,
      successExit: (name: string) => `${name}, तपाईंको बहिर्गमन सफलतापूर्वक दर्ता भयो।`,
      processedAt: (time: string) => `${time} मा दर्ता गरियो`
    }
  };

  selectedLanguage: LanguageCode = this.readSavedLanguage();
  selectedWorksite: WorksiteDefinition | null = null;
  pin = '';
  submitting = false;
  currentTime = new Date();
  feedback: FeedbackState | null = null;
  currentPosition: CurrentPosition | null = null;
  locationState: LocationState = 'idle';
  locationCapturedAt: Date | null = null;
  readonly locationValidityMs = 10 * 60 * 1000;

  private map: L.Map | null = null;
  private zoneShape: L.Polygon | L.Circle | null = null;
  private zoneCenterMarker: L.CircleMarker | null = null;
  private userMarker: L.CircleMarker | null = null;
  private accuracyCircle: L.Circle | null = null;
  private watchId: number | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private api: SharedService) {}

  ngOnInit(): void {
    this.clockTimer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  ngAfterViewInit(): void {
    this.initMap();
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

  get activeZoneCenter(): { lat: number; lng: number } {
    return this.selectedWorksite?.center ?? this.sharedLakeHomeCenter;
  }

  get canSubmit(): boolean {
    return !!this.pin.trim() && !!this.selectedWorksite && this.effectiveLocationState === 'inside' && !this.submitting;
  }

  get gateReady(): boolean {
    return !!this.selectedWorksite && this.effectiveLocationState === 'inside';
  }

  get effectiveLocationState(): LocationState {
    if (this.locationState === 'inside' || this.locationState === 'outside') {
      return this.isLocationFresh ? this.locationState : 'expired';
    }

    if (this.currentPosition && this.locationCapturedAt && !this.isLocationFresh) {
      return 'expired';
    }

    return this.locationState;
  }

  get isLocationFresh(): boolean {
    if (!this.locationCapturedAt) {
      return false;
    }

    return (this.currentTime.getTime() - this.locationCapturedAt.getTime()) <= this.locationValidityMs;
  }

  get locationFreshForLabel(): string | null {
    if (!this.locationCapturedAt || !this.isLocationFresh) {
      return null;
    }

    const remainingMs = Math.max(0, this.locationValidityMs - (this.currentTime.getTime() - this.locationCapturedAt.getTime()));
    return this.getLocationFreshForText(this.formatRemainingTime(remainingMs));
  }

  get gateMessage(): string {
    if (!this.selectedWorksite) {
      return this.t.worksiteRequired;
    }

    const state = this.effectiveLocationState;
    if (state === 'idle') {
      return this.getLocationMissingErrorText();
    }

    if (state === 'expired') {
      return this.getLocationExpiredErrorText();
    }

    if (state === 'loading') {
      return this.t.gpsLoadingDetail;
    }

    if (state === 'inside') {
      return this.t.zoneAllowed;
    }

    if (state === 'outside') {
      return this.t.zoneRestriction;
    }

    return this.locationDetail;
  }

  get locationBadge(): string {
    if (!this.selectedWorksite) {
      return this.t.worksitePlaceholder;
    }

    const state = this.effectiveLocationState;
    if (state === 'idle' || state === 'expired') {
      return this.getLocationCopy(state).badge;
    }

    return {
      idle: this.t.worksitePlaceholder,
      loading: this.t.gpsLoadingBadge,
      inside: this.t.gpsInsideBadge,
      outside: this.t.gpsOutsideBadge,
      expired: this.t.gpsOutsideBadge,
      denied: this.t.gpsDeniedBadge,
      unsupported: this.t.gpsUnsupportedBadge,
      error: this.t.gpsErrorBadge
    }[state];
  }

  get locationTitle(): string {
    if (!this.selectedWorksite) {
      return this.t.worksiteLabel;
    }

    const state = this.effectiveLocationState;
    if (state === 'idle' || state === 'expired') {
      return this.getLocationCopy(state).title;
    }

    return {
      idle: this.t.worksiteLabel,
      loading: this.t.gpsLoadingTitle,
      inside: this.t.gpsInsideTitle,
      outside: this.t.gpsOutsideTitle,
      expired: this.t.gpsOutsideTitle,
      denied: this.t.gpsDeniedTitle,
      unsupported: this.t.gpsUnsupportedTitle,
      error: this.t.gpsErrorTitle
    }[state];
  }

  get locationDetail(): string {
    if (!this.selectedWorksite) {
      return this.t.worksiteHelper;
    }

    const state = this.effectiveLocationState;
    if (state === 'idle' || state === 'expired') {
      return this.getLocationCopy(state).detail;
    }

    return {
      idle: this.t.worksiteHelper,
      loading: this.t.gpsLoadingDetail,
      inside: this.t.gpsInsideDetail,
      outside: this.t.gpsOutsideDetail,
      expired: this.t.gpsOutsideDetail,
      denied: this.t.gpsDeniedDetail,
      unsupported: this.t.gpsUnsupportedDetail,
      error: this.t.gpsErrorDetail
    }[state];
  }

  setLanguage(code: LanguageCode): void {
    this.selectedLanguage = code;
    localStorage.setItem('clockinandout-language', code);
    this.updateZoneTooltip();
  }

  get selectedWorksiteName(): string {
    return this.selectedWorksite?.name ?? '';
  }

  setWorksite(worksite: WorksiteDefinition | null): void {
    this.selectedWorksite = worksite;
    this.updateZoneVisualization();

    if (!worksite) {
      this.stopGeolocation();
      this.locationState = 'idle';
      return;
    }

    if (this.currentPosition) {
      this.recomputeZoneMembership();
      this.updateUserLayers();
      return;
    }

    this.locationState = 'idle';
  }

  updatePin(value: string): void {
    this.pin = value.replace(/\D/g, '').slice(0, 12);
  }

  clearPin(): void {
    this.pin = '';
  }

  refreshLocation(): void {
    if (!this.selectedWorksite) {
      this.showError(this.t.worksiteRequired);
      return;
    }

    this.requestFreshLocation();
  }

  submitPin(): void {
    if (!this.selectedWorksite) {
      this.showError(this.t.worksiteRequired);
      return;
    }

    if (!this.currentPosition) {
      this.showError(this.getLocationMissingErrorText());
      return;
    }

    if (this.effectiveLocationState === 'expired') {
      this.showError(this.getLocationExpiredErrorText());
      return;
    }

    if (!this.canSubmit) {
      this.showError(this.t.zoneRestriction);
      return;
    }

    const cleanPin = this.pin.trim();
    this.submitting = true;

    this.api.manualAttendanceByPin(cleanPin, {
      worksite: this.selectedWorksite.name,
      mode: 'manual',
      gps: {
        lat: this.currentPosition.lat,
        lng: this.currentPosition.lng,
        accuracy: this.currentPosition.accuracy,
        capturedAt: this.locationCapturedAt?.toISOString()
      }
    }).subscribe({
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
        const message = this.resolveAttendanceError(error);
        this.showError(message);
        this.clearPin();
      }
    });
  }

  formatCoordinates(lat: number, lng: number): string {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  private showAttendanceFeedback(state: AttendanceState, userName: string): void {
    this.feedback = state === 'ENTER'
      ? {
          kind: 'enter',
          title: this.t.enterTitle,
          message: this.t.successEnter(userName),
          stamp: this.t.processedAt(this.formattedTime)
        }
      : {
          kind: 'exit',
          title: this.t.exitTitle,
          message: this.t.successExit(userName),
          stamp: this.t.processedAt(this.formattedTime)
        };

    this.scheduleFeedbackReset();
  }

  private showError(message: string): void {
    this.feedback = {
      kind: 'error',
      title: this.t.errorTitle,
      message,
      stamp: this.t.processedAt(this.formattedTime)
    };

    this.scheduleFeedbackReset();
  }

  private resolveAttendanceError(error: any): string {
    const code = typeof error?.error?.error_code === 'string' ? error.error.error_code : '';
    if (code === 'MANUAL_DEVICE_LOCKED') {
      return this.t.manualDeviceLockedError;
    }

    if (code === 'MANUAL_CHECKOUT_DEVICE_MISMATCH') {
      return this.t.manualCheckoutSameDeviceError;
    }

    if (code === 'GPS_CAPTURE_EXPIRED') {
      return this.getLocationExpiredErrorText();
    }

    return typeof error?.error?.error === 'string' ? error.error.error : this.t.genericError;
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

    this.map.setView([45.7983, 24.1256], 7);
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private updateZoneVisualization(): void {
    if (!this.map) {
      return;
    }

    if (this.zoneShape) {
      this.map.removeLayer(this.zoneShape);
      this.zoneShape = null;
    }

    if (this.zoneCenterMarker) {
      this.map.removeLayer(this.zoneCenterMarker);
      this.zoneCenterMarker = null;
    }

    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
      this.userMarker = null;
    }

    if (this.accuracyCircle) {
      this.map.removeLayer(this.accuracyCircle);
      this.accuracyCircle = null;
    }

    const worksite = this.selectedWorksite;
    if (!worksite) {
      this.map.setView([45.7983, 24.1256], 7);
      return;
    }

    this.zoneShape = worksite.type === 'polygon'
      ? L.polygon(worksite.polygon!, {
          color: '#0f766e',
          weight: 2,
          fillColor: '#0f766e',
          fillOpacity: 0.14
        }).addTo(this.map)
      : L.circle([worksite.center.lat, worksite.center.lng], {
          radius: worksite.radiusMeters!,
          color: '#0f766e',
          weight: 2,
          fillColor: '#0f766e',
          fillOpacity: 0.14
        }).addTo(this.map);

    this.zoneCenterMarker = L.circleMarker([worksite.center.lat, worksite.center.lng], {
      radius: 7,
      color: '#0f766e',
      weight: 2,
      fillColor: '#f8fafc',
      fillOpacity: 1
    }).addTo(this.map);

    this.updateZoneTooltip();

    this.focusMapOnWorksite(worksite);
  }

  private requestFreshLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.locationState = 'unsupported';
      return;
    }

    this.stopGeolocation();
    this.locationState = 'loading';

    navigator.geolocation.getCurrentPosition(
      (position) => this.handlePosition(position),
      (error) => this.handlePositionError(error),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
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
    this.locationCapturedAt = new Date();

    this.recomputeZoneMembership();
    this.updateUserLayers();
  }

  private handlePositionError(error: GeolocationPositionError): void {
    if (error.code === error.PERMISSION_DENIED) {
      this.locationState = 'denied';
      return;
    }

    this.locationState = 'error';
  }

  private recomputeZoneMembership(): void {
    if (!this.currentPosition) {
      this.locationState = 'loading';
      return;
    }

    const worksite = this.selectedWorksite;
    if (!worksite) {
      this.locationState = 'loading';
      return;
    }

    this.locationState = this.pointInsideWorksite(this.currentPosition, worksite) ? 'inside' : 'outside';
  }

  private updateUserLayers(): void {
    if (!this.map || !this.currentPosition || !this.selectedWorksite) {
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
    this.focusMapOnCurrentContext();
  }

  private focusMapOnWorksite(worksite: WorksiteDefinition): void {
    if (!this.map) {
      return;
    }

    if (worksite.type === 'circle') {
      this.map.setView([worksite.center.lat, worksite.center.lng], 18, { animate: false });

      setTimeout(() => {
        this.map?.invalidateSize();
        this.map?.setView([worksite.center.lat, worksite.center.lng], 18, { animate: false });
      }, 50);
      return;
    }

    const zoneBounds = this.getWorksiteBounds(worksite).pad(0.22);
    this.map.fitBounds(zoneBounds, { maxZoom: 18, animate: false });

    setTimeout(() => {
      this.map?.invalidateSize();
      this.map?.fitBounds(zoneBounds, { maxZoom: 18, animate: false });
    }, 50);
  }

  private focusMapOnCurrentContext(): void {
    if (!this.map || !this.selectedWorksite || !this.currentPosition) {
      return;
    }

    const worksiteBounds = this.getWorksiteBounds(this.selectedWorksite);
    const userLatLng = L.latLng(this.currentPosition.lat, this.currentPosition.lng);
    const siteCenter = L.latLng(this.selectedWorksite.center.lat, this.selectedWorksite.center.lng);
    const distanceToWorksite = userLatLng.distanceTo(siteCenter);

    if (distanceToWorksite > 250) {
      return;
    }

    const combinedBounds = worksiteBounds.extend(userLatLng).pad(0.28);
    this.map.fitBounds(combinedBounds, { maxZoom: 18, animate: false });
  }

  private pointInsideWorksite(position: CurrentPosition, worksite: WorksiteDefinition): boolean {
    if (worksite.type === 'circle') {
      return L.latLng(position.lat, position.lng).distanceTo(L.latLng(worksite.center.lat, worksite.center.lng)) <= (worksite.radiusMeters ?? 0);
    }

    return this.pointInsidePolygon(position.lat, position.lng, worksite.polygon ?? []);
  }

  private pointInsidePolygon(lat: number, lng: number, polygon: L.LatLngTuple[]): boolean {
    if (!polygon.length) {
      return false;
    }

    if (this.isPointOnPolygonEdge(lat, lng, polygon)) {
      return true;
    }

    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const yi = polygon[i][0];
      const xi = polygon[i][1];
      const yj = polygon[j][0];
      const xj = polygon[j][1];

      const intersects = ((yi > lat) !== (yj > lat)) &&
        (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  private isPointOnPolygonEdge(lat: number, lng: number, polygon: L.LatLngTuple[]): boolean {
    const tolerance = 0.0000005;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const ay = polygon[j][0];
      const ax = polygon[j][1];
      const by = polygon[i][0];
      const bx = polygon[i][1];

      const cross = Math.abs((lng - ax) * (by - ay) - (lat - ay) * (bx - ax));
      if (cross > tolerance) {
        continue;
      }

      const dot = (lng - ax) * (bx - ax) + (lat - ay) * (by - ay);
      if (dot < 0) {
        continue;
      }

      const lenSq = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
      if (dot <= lenSq) {
        return true;
      }
    }

    return false;
  }

  private computePolygonCenter(points: L.LatLngTuple[]): { lat: number; lng: number } {
    return {
      lat: points.reduce((sum, point) => sum + point[0], 0) / points.length,
      lng: points.reduce((sum, point) => sum + point[1], 0) / points.length
    };
  }

  private getWorksiteBounds(worksite: WorksiteDefinition): L.LatLngBounds {
    return worksite.type === 'polygon'
      ? L.latLngBounds(worksite.polygon!)
      : L.circle([worksite.center.lat, worksite.center.lng], { radius: worksite.radiusMeters! }).getBounds();
  }

  private updateZoneTooltip(): void {
    if (!this.zoneCenterMarker) {
      return;
    }

    const label = this.selectedWorksite?.name || this.t.worksitePlaceholder;
    this.zoneCenterMarker.unbindTooltip();
    this.zoneCenterMarker.bindTooltip(label, {
      permanent: false,
      direction: 'top'
    });
  }

  private formatRemainingTime(remainingMs: number): string {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private getLocationFreshForText(time: string): string {
    switch (this.selectedLanguage) {
      case 'en':
        return `Location valid for ${time}.`;
      case 'pa':
        return `ਲੋਕੇਸ਼ਨ ਹੋਰ ${time} ਲਈ ਵੈਧ ਹੈ।`;
      case 'hi':
        return `लोकेशन ${time} तक मान्य है।`;
      case 'ne':
        return `लोकेशन अझै ${time} सम्म मान्य छ।`;
      default:
        return `Locatia este valabila inca ${time}.`;
    }
  }

  private getLocationMissingErrorText(): string {
    switch (this.selectedLanguage) {
      case 'en':
        return 'Press Get my live location and then enter the PIN within 10 minutes.';
      case 'pa':
        return 'ਪਹਿਲਾਂ ਮੇਰੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਲਵੋ ਦਬਾਓ, ਫਿਰ 10 ਮਿੰਟਾਂ ਅੰਦਰ ਪਿੰਨ ਦਾਖਲ ਕਰੋ।';
      case 'hi':
        return 'पहले मेरी लाइव लोकेशन लो दबाएं, फिर 10 मिनट के भीतर पिन दर्ज करें।';
      case 'ne':
        return 'पहिले मेरो हालको लोकेशन लिनुहोस् थिच्नुहोस्, त्यसपछि १० मिनेटभित्र पिन हाल्नुहोस्।';
      default:
        return 'Apasa pe Ia-mi locatia mea live, apoi introdu PIN-ul in maximum 10 minute.';
    }
  }

  private getLocationExpiredErrorText(): string {
    switch (this.selectedLanguage) {
      case 'en':
        return 'The saved location expired. Press Get my live location again and then enter the PIN within 10 minutes.';
      case 'pa':
        return 'ਸੇਵ ਕੀਤੀ ਲੋਕੇਸ਼ਨ ਮਿਆਦ ਤੋਂ ਬਾਹਰ ਹੋ ਗਈ ਹੈ। ਦੁਬਾਰਾ ਮੇਰੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਲਵੋ ਦਬਾਓ ਅਤੇ 10 ਮਿੰਟਾਂ ਅੰਦਰ ਪਿੰਨ ਦਾਖਲ ਕਰੋ।';
      case 'hi':
        return 'सहेजी गई लोकेशन की समय-सीमा खत्म हो गई है। फिर से मेरी लाइव लोकेशन लो दबाएं और 10 मिनट के भीतर पिन दर्ज करें।';
      case 'ne':
        return 'सेभ गरिएको लोकेशनको समय सकिएको छ। फेरि मेरो हालको लोकेशन लिनुहोस् थिच्नुहोस् र १० मिनेटभित्र पिन हाल्नुहोस्।';
      default:
        return 'Locatia salvata a expirat. Apasa din nou pe Ia-mi locatia mea live si introdu PIN-ul in maximum 10 minute.';
    }
  }

  private getLocationCopy(state: 'idle' | 'expired'): { badge: string; title: string; detail: string } {
    if (state === 'expired') {
      switch (this.selectedLanguage) {
        case 'en':
          return {
            badge: 'Location expired',
            title: 'The saved GPS location has expired.',
            detail: 'Press Get my live location again. The saved position can be used for attendance for 10 minutes only.'
          };
        case 'pa':
          return {
            badge: 'ਲੋਕੇਸ਼ਨ ਮਿਆਦ ਖਤਮ',
            title: 'ਸੇਵ ਕੀਤੀ GPS ਲੋਕੇਸ਼ਨ ਦੀ ਮਿਆਦ ਖਤਮ ਹੋ ਗਈ ਹੈ।',
            detail: 'ਦੁਬਾਰਾ ਮੇਰੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਲਵੋ ਦਬਾਓ। ਸੇਵ ਕੀਤੀ ਲੋਕੇਸ਼ਨ ਸਿਰਫ਼ 10 ਮਿੰਟ ਲਈ ਹੀ ਵਰਤੀ ਜਾ ਸਕਦੀ ਹੈ।'
          };
        case 'hi':
          return {
            badge: 'लोकेशन समाप्त',
            title: 'सहेजी गई GPS लोकेशन की समय-सीमा समाप्त हो गई है।',
            detail: 'फिर से मेरी लाइव लोकेशन लो दबाएं। सहेजी गई लोकेशन केवल 10 मिनट तक मान्य रहती है।'
          };
        case 'ne':
          return {
            badge: 'लोकेशन सकियो',
            title: 'सेभ गरिएको GPS लोकेशनको समय सकिएको छ।',
            detail: 'फेरि मेरो हालको लोकेशन लिनुहोस् थिच्नुहोस्। सेभ गरिएको लोकेशन १० मिनेट मात्र मान्य हुन्छ।'
          };
        default:
          return {
            badge: 'Locatie expirata',
            title: 'Locatia GPS salvata a expirat.',
            detail: 'Apasa din nou pe Ia-mi locatia mea live. Pozitia salvata poate fi folosita pentru pontaj doar 10 minute.'
          };
      }
    }

    switch (this.selectedLanguage) {
      case 'en':
        return {
          badge: 'Location needed',
          title: 'Capture your current GPS location first.',
          detail: 'Press Get my live location. After the location is captured, you have 10 minutes to enter the PIN.'
        };
      case 'pa':
        return {
          badge: 'ਲੋਕੇਸ਼ਨ ਚਾਹੀਦੀ ਹੈ',
          title: 'ਸਭ ਤੋਂ ਪਹਿਲਾਂ ਆਪਣੀ ਮੌਜੂਦਾ GPS ਲੋਕੇਸ਼ਨ ਲਵੋ।',
          detail: 'ਮੇਰੀ ਮੌਜੂਦਾ ਲੋਕੇਸ਼ਨ ਲਵੋ ਦਬਾਓ। ਲੋਕੇਸ਼ਨ ਮਿਲਣ ਤੋਂ ਬਾਅਦ ਤੁਹਾਡੇ ਕੋਲ ਪਿੰਨ ਦਾਖਲ ਕਰਨ ਲਈ 10 ਮਿੰਟ ਹੋਣਗੇ।'
        };
      case 'hi':
        return {
          badge: 'लोकेशन चाहिए',
          title: 'पहले अपनी वर्तमान GPS लोकेशन लें।',
          detail: 'मेरी लाइव लोकेशन लो दबाएं। लोकेशन मिल जाने के बाद आपके पास पिन दर्ज करने के लिए 10 मिनट होंगे।'
        };
      case 'ne':
        return {
          badge: 'लोकेशन चाहिन्छ',
          title: 'पहिले आफ्नो हालको GPS लोकेशन लिनुहोस्।',
          detail: 'मेरो हालको लोकेशन लिनुहोस् थिच्नुहोस्। लोकेशन आएपछि पिन हाल्न १० मिनेट समय हुनेछ।'
        };
      default:
        return {
          badge: 'Locatie necesara',
          title: 'Ia mai intai locatia GPS curenta.',
          detail: 'Apasa pe Ia-mi locatia mea live. Dupa ce locatia este capturata, ai 10 minute sa introduci PIN-ul.'
        };
    }
  }

  private readSavedLanguage(): LanguageCode {
    const saved = localStorage.getItem('clockinandout-language') as LanguageCode | null;
    if (saved && this.languages.some((language) => language.code === saved)) {
      return saved;
    }

    return 'ro';
  }
}
