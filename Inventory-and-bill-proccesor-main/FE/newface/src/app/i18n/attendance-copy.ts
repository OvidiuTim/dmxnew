import { EmployeeLanguage } from './employee-language';
export interface TranslationPack {
  back: string;
  backDashboard: string;
  selfieTitle: string;
  selfieDescription: string;
  selfieConfirmed: string;
  openCamera: string;
  takePhoto: string;
  retakePhoto: string;
  usePhoto: string;
  photoUsed: string;
  consentPrefix: string;
  consentLink: string;
  consentHint: string;
  consentRequired: string;
  selfieRequired: string;
  unfinishedTitle: string;
  pinFirst: string;
  cameraUnavailable: string;
  cameraNotReady: string;
  cameraDenied: string;
  cameraMissing: string;
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
  selectedWorksiteLabel: string;
  zoneCenterLabel: string;
  yourPositionLabel: string;
  accuracyLabel: (meters: number) => string;
  successEnter: (name: string) => string;
  successExit: (name: string) => string;
  processedAt: (time: string) => string;
}

export const attendanceCopy: Record<EmployeeLanguage, TranslationPack> = {
    ro: {
      back: 'Înapoi',
      backDashboard: 'Înapoi la dashboard',
      selfieTitle: 'Adaugă selfie',
      selfieDescription: 'Pentru a continua pontajul, realizează un selfie clar, cu fața vizibilă. Fotografia va fi asociată acestui check-in sau check-out pentru confirmarea identității.',
      selfieConfirmed: 'Fotografie confirmată', openCamera: 'Deschide camera', takePhoto: 'Fă fotografia', retakePhoto: 'Refă fotografia', usePhoto: 'Folosește fotografia', photoUsed: 'Fotografie folosită',
      consentPrefix: 'Sunt de acord cu', consentLink: 'prelucrarea datelor', consentHint: 'Selfie-ul confirmat va fi asociat acestui check-in sau check-out.',
      consentRequired: 'Bifează acordul pentru prelucrarea datelor pentru a activa pontajul.', selfieRequired: 'Realizează și confirmă selfie-ul pentru a activa pontajul.', unfinishedTitle: 'Pontaj nefinalizat',
      pinFirst: 'Introdu mai întâi PIN-ul.', cameraUnavailable: 'Camera telefonului nu este disponibilă în acest browser.', cameraNotReady: 'Camera nu este pregătită. Încearcă din nou.', cameraDenied: 'Accesul la cameră a fost refuzat. Permite camera din setările browserului.', cameraMissing: 'Nu am găsit o cameră disponibilă pe acest dispozitiv.',
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
      invalidPin: 'Nu am gasit niciun angajat cu acest PIN.',
      genericError: 'Nu am putut inregistra pontajul acum. Incearca din nou.',
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
      back: 'Back',
      backDashboard: 'Back to dashboard',
      selfieTitle: 'Add a selfie',
      selfieDescription: 'To continue attendance, take a clear selfie with your face visible. The photo will be linked to this clock-in or clock-out to confirm your identity.',
      selfieConfirmed: 'Photo confirmed', openCamera: 'Open camera', takePhoto: 'Take photo', retakePhoto: 'Retake photo', usePhoto: 'Use photo', photoUsed: 'Photo selected',
      consentPrefix: 'I agree to', consentLink: 'data processing', consentHint: 'The confirmed selfie will be linked to this clock-in or clock-out.',
      consentRequired: 'Accept data processing to enable attendance.', selfieRequired: 'Take and confirm a selfie to enable attendance.', unfinishedTitle: 'Attendance not completed',
      pinFirst: 'Enter the PIN first.', cameraUnavailable: 'The phone camera is not available in this browser.', cameraNotReady: 'The camera is not ready. Please try again.', cameraDenied: 'Camera access was denied. Allow camera access in browser settings.', cameraMissing: 'No available camera was found on this device.',
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
      invalidPin: 'No employee was found with this PIN.',
      genericError: 'The attendance could not be recorded right now. Please try again.',
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
      back: 'ਵਾਪਸ',
      backDashboard: 'ਡੈਸ਼ਬੋਰਡ ਤੇ ਵਾਪਸ',
      selfieTitle: 'ਸੈਲਫੀ ਸ਼ਾਮਲ ਕਰੋ', selfieDescription: 'ਹਾਜ਼ਰੀ ਜਾਰੀ ਰੱਖਣ ਲਈ ਚਿਹਰਾ ਸਾਫ਼ ਦਿਖਾਈ ਦੇਣ ਵਾਲੀ ਸੈਲਫੀ ਲਵੋ। ਪਛਾਣ ਦੀ ਪੁਸ਼ਟੀ ਲਈ ਫੋਟੋ ਇਸ ਚੈਕ ਇਨ ਜਾਂ ਚੈਕ ਆਉਟ ਨਾਲ ਜੋੜੀ ਜਾਵੇਗੀ।',
      selfieConfirmed: 'ਫੋਟੋ ਦੀ ਪੁਸ਼ਟੀ ਹੋਈ', openCamera: 'ਕੈਮਰਾ ਖੋਲ੍ਹੋ', takePhoto: 'ਫੋਟੋ ਲਵੋ', retakePhoto: 'ਫੋਟੋ ਦੁਬਾਰਾ ਲਵੋ', usePhoto: 'ਫੋਟੋ ਵਰਤੋ', photoUsed: 'ਫੋਟੋ ਚੁਣੀ ਗਈ',
      consentPrefix: 'ਮੈਂ ਸਹਿਮਤ ਹਾਂ', consentLink: 'ਡਾਟਾ ਪ੍ਰੋਸੈਸਿੰਗ', consentHint: 'ਪੁਸ਼ਟੀ ਕੀਤੀ ਸੈਲਫੀ ਇਸ ਚੈਕ ਇਨ ਜਾਂ ਚੈਕ ਆਉਟ ਨਾਲ ਜੋੜੀ ਜਾਵੇਗੀ।', consentRequired: 'ਹਾਜ਼ਰੀ ਲਈ ਡਾਟਾ ਪ੍ਰੋਸੈਸਿੰਗ ਦੀ ਸਹਿਮਤੀ ਦਿਓ।', selfieRequired: 'ਹਾਜ਼ਰੀ ਲਈ ਸੈਲਫੀ ਲੈ ਕੇ ਪੁਸ਼ਟੀ ਕਰੋ।', unfinishedTitle: 'ਹਾਜ਼ਰੀ ਪੂਰੀ ਨਹੀਂ ਹੋਈ',
      pinFirst: 'ਪਹਿਲਾਂ ਪਿੰਨ ਦਾਖਲ ਕਰੋ।', cameraUnavailable: 'ਇਸ ਬਰਾਊਜ਼ਰ ਵਿੱਚ ਫੋਨ ਕੈਮਰਾ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।', cameraNotReady: 'ਕੈਮਰਾ ਤਿਆਰ ਨਹੀਂ ਹੈ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।', cameraDenied: 'ਕੈਮਰਾ ਐਕਸੈਸ ਰੱਦ ਕੀਤਾ ਗਿਆ। ਬਰਾਊਜ਼ਰ ਸੈਟਿੰਗਾਂ ਵਿੱਚ ਆਗਿਆ ਦਿਓ।', cameraMissing: 'ਇਸ ਡਿਵਾਈਸ ਤੇ ਕੋਈ ਕੈਮਰਾ ਨਹੀਂ ਮਿਲਿਆ।',
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
      invalidPin: 'ਇਸ ਪਿੰਨ ਨਾਲ ਕੋਈ ਕਰਮਚਾਰੀ ਨਹੀਂ ਮਿਲਿਆ।',
      genericError: 'ਇਸ ਵੇਲੇ ਹਾਜ਼ਰੀ ਦਰਜ ਨਹੀਂ ਹੋ ਸਕੀ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
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
      back: 'वापस',
      backDashboard: 'डैशबोर्ड पर वापस',
      selfieTitle: 'सेल्फी जोड़ें', selfieDescription: 'उपस्थिति जारी रखने के लिए चेहरा साफ़ दिखने वाली सेल्फी लें। पहचान की पुष्टि के लिए फोटो इस चेक-इन या चेक-आउट से जोड़ी जाएगी।',
      selfieConfirmed: 'फोटो की पुष्टि हुई', openCamera: 'कैमरा खोलें', takePhoto: 'फोटो लें', retakePhoto: 'फोटो फिर लें', usePhoto: 'फोटो उपयोग करें', photoUsed: 'फोटो चुनी गई',
      consentPrefix: 'मैं सहमत हूँ', consentLink: 'डेटा प्रोसेसिंग', consentHint: 'पुष्टि की गई सेल्फी इस चेक-इन या चेक-आउट से जोड़ी जाएगी।', consentRequired: 'उपस्थिति के लिए डेटा प्रोसेसिंग की सहमति दें।', selfieRequired: 'उपस्थिति के लिए सेल्फी लेकर पुष्टि करें।', unfinishedTitle: 'उपस्थिति पूरी नहीं हुई',
      pinFirst: 'पहले पिन दर्ज करें।', cameraUnavailable: 'इस ब्राउज़र में फोन का कैमरा उपलब्ध नहीं है।', cameraNotReady: 'कैमरा तैयार नहीं है। फिर प्रयास करें।', cameraDenied: 'कैमरा एक्सेस अस्वीकार हुआ। ब्राउज़र सेटिंग में अनुमति दें।', cameraMissing: 'इस डिवाइस पर कोई कैमरा उपलब्ध नहीं मिला।',
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
      invalidPin: 'इस पिन से कोई कर्मचारी नहीं मिला।',
      genericError: 'अभी उपस्थिति दर्ज नहीं हो सकी। कृपया फिर से प्रयास करें।',
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
      back: 'फर्कनुहोस्',
      backDashboard: 'ड्यासबोर्डमा फर्कनुहोस्',
      selfieTitle: 'सेल्फी थप्नुहोस्', selfieDescription: 'हाजिरी जारी राख्न अनुहार स्पष्ट देखिने सेल्फी लिनुहोस्। पहिचान पुष्टि गर्न फोटो यस चेक इन वा चेक आउटसँग जोडिनेछ।',
      selfieConfirmed: 'फोटो पुष्टि भयो', openCamera: 'क्यामेरा खोल्नुहोस्', takePhoto: 'फोटो लिनुहोस्', retakePhoto: 'फोटो फेरि लिनुहोस्', usePhoto: 'फोटो प्रयोग गर्नुहोस्', photoUsed: 'फोटो चयन भयो',
      consentPrefix: 'म सहमत छु', consentLink: 'डेटा प्रशोधन', consentHint: 'पुष्टि गरिएको सेल्फी यस चेक इन वा चेक आउटसँग जोडिनेछ।', consentRequired: 'हाजिरीका लागि डेटा प्रशोधन स्वीकार गर्नुहोस्।', selfieRequired: 'हाजिरीका लागि सेल्फी लिएर पुष्टि गर्नुहोस्।', unfinishedTitle: 'हाजिरी पूरा भएन',
      pinFirst: 'पहिले पिन हाल्नुहोस्।', cameraUnavailable: 'यो ब्राउजरमा फोनको क्यामेरा उपलब्ध छैन।', cameraNotReady: 'क्यामेरा तयार छैन। फेरि प्रयास गर्नुहोस्।', cameraDenied: 'क्यामेरा पहुँच अस्वीकार भयो। ब्राउजर सेटिङमा अनुमति दिनुहोस्।', cameraMissing: 'यस उपकरणमा उपलब्ध क्यामेरा भेटिएन।',
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
      invalidPin: 'यो पिन भएका कर्मचारी भेटिएनन्।',
      genericError: 'अहिले हाजिरी दर्ता गर्न सकिएन। फेरि प्रयास गर्नुहोस्।',
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
