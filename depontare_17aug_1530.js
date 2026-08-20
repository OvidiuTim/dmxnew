(async () => {
  const API = "/api/nfc/scan/";
  const SANTIER = "Tractorului Bloc A";
  const DATA_IESIRE = "2026-08-17T15:30:00+03:00";
  const angajati = [
    ["1998", "SURESH KUMAR N7173256"],
    ["1685", "MANDEEP SINGH T4897284"],
    ["8807", "JHIM AKASH Y6901812"],
    ["4120", "DAVID GH. DUMITRU"],
    ["6143", "FRĂȚILĂ MIRCEA"],
    ["4423", "GRENDELY ARPAD"],
    ["4731", "HOCA ION ARON"],
    ["7492", "MAIER RAUL ANDREI"],
    ["4140", "SUCIU NICUȘOR"],
    ["9292", "SOPIUNEAC VLADIMIR DAN"],
    ["9086", "LUP DARIUS"],
    ["7934", "STOICA GHEORGHE"],
    ["6563", "PREM SINGH"],
    ["4250", "KAMALJEET"],
    ["3808", "BALWINDER SINGH"],
    ["3382", "KUMAR AMIT"],
    ["8756", "RAJWINDER PAL"],
    ["8470", "NARINDERJIT KUMAR"],
    ["8154", "GAGANDEEP SINGH"],
    ["6560", "SIDHU HARJEET SINGH"],
    ["7000", "PAWAN KUMAR"],
    ["5256", "KULDIP SINGH"],
    ["5928", "SUNIL SAPAIYA"],
    ["1676", "TOTA RAM"],
    ["1656", "MATTU AMARJIT X5414460"],
    ["5878", "MOHINDER PAL N3101118"],
    ["6546", "NEERAJ KUMAR Y5062539"],
    ["4565", "MATIN MD ABDUL"],
    ["8304", "MADAN LAL P5996903"],
    ["9657", "PAUL SUSHIL T6011832"],
    ["2759", "GOPAL RAM R5823936"],
    ["5631", "NARESH KUMAR T9166361"],
    ["9601", "LOVEPREET SINGH R9409268"],
    ["9900", "AMARDEEP SINGH W2190376"],
    ["9561", "SAGAR SINGH B7406434"],
    ["3223", "HARWINDER KUMAR B740066"],
    ["1833", "HARJINDER KUMAR U6321617"],
    ["5247", "BALU MANDEEP P2991038"],
    ["7449", "KUMAR SADANAND W5753967"],
    ["9913", "LAKHVIR SINGH S9306436"],
    ["1183", "PARVEEN KUMAR R7851622"],
    ["5460", "SUKHWINDER SINGH R7857301"],
    ["5576", "SURINDER PAL R2351098"],
    ["2526", "HEM RAJ P1063094"],
    ["5665", "GURWINDER V7486802"],
    ["4819", "AMRITPAL SINGH W3051542"],
    ["9844", "SINGH JASDEEP T9173481"],
    ["7955", "SHANY KUMAR T3057053"],
    ["2282", "SHAMSHER SINGH Y3862786"],
    ["2319", "RAVINDER KUMAR P7689567"],
    ["2340", "RAKESH KUMAR R3796050"],
    ["4709", "RAJ KUMAR T7409445"],
    ["2992", "NARESH KUMAR C2414479"],
    ["3587", "JASVIR KUMAR W3748205"],
    ["4095", "MOHAMAD AJMER X8481729"],
    ["6417", "ANTONESCU SILVIU"],
    ["8728", "PETRISOR MARIUS"],
    ["8804", "URSU AUGUSTIN"],
    ["5410", "AKASHDEEP X8466976"],
    ["1153", "AMRIK LAL S5757375"],
    ["2839", "KULDEEP KUMAR W6756683"],
    ["5541", "JASWINDER LAL AJ833219"],
    ["5043", "MAHESH Y4487638"],
    ["4685", "LAKHVIR KUMAR P0401419"],
    ["3304", "GAGANDEEP U9024811"],
    ["2693", "PARWINDER SINGH Y6900562"],
    ["2437", "SUKHDEEP SINGH V3337617"],
    ["1525", "RAVINDER KUMAR W6798795 USER 10"],
    ["9999", "THAPA MAGAR CHET BADADUR PA3761977"],
    ["9998", "BALJINDER PAUL SINGH S7060066"],
    ["9992", "DAVINDER KUMAR W1121875"],
    ["9991", "DINESH KUMAR V3248742"],
    ["9990", "GURMEET SINGH V5458750"],
    ["9989", "HARDEEP SINGH Y4080548"],
    ["9988", "HARJINDER RAM P9498105"],
    ["9986", "JAGWINDER SINGH T4938589"],
    ["8008", "KALER MANJINDER P6509971"],
    ["9985", "KAMALJIT W6802483"],
    ["9984", "MANJINDER KUMAR P9515127"],
    ["9983", "MANOJ KUMAR B6074911"],
    ["9982", "MANPREET V1380187"],
    ["9981", "MOLDOVAN RAUL GHEORGHE"],
    ["9980", "MULAKH RAJ C7643676"],
    ["9979", "BHATTARAI DAMBER BAHADUR PA4426810"],
    ["9978", "NEERAJ KUMAR Z7751757"],
    ["9976", "OM PARKASH U6328221"],
    ["9974", "SURJIT KUMAR"],
    ["9973", "RANA DIL BAHADUR BA0362892"],
    ["9969", "SINGH MANJEET T0133063"],
    ["9968", "SODHI RAM P3587564"],
    ["9964", "VIRDAS B6781275"],
    ["9961", "NAȘCU CONSTANTIN"],
    ["9960", "POPOVICIU BOGDAN-TIBERIU"],
    ["11111", "SACHIN KUMAR C7661833"],
    ["22222", "ADMIN"],
    ["9957", "JASSI VISHA U6168789"],
    ["9955", "SUWAN SALWAN C0166338"],
    ["9954", "VINOD KUMAR Y1815857"],
    ["9952", "COMIZA TEODOR IOAN"],
    ["9949", "DHENGA DIPAK 11154953"],
    ["9948", "MANDEEP SINGH V5447334"],
    ["9947", "ALDUCA RADU"],
    ["9946", "KAMAL"],
    ["9945", "NIRAJ KUMAR"],
    ["9944", "DANGI KAMAL PA3628402"],
    ["9943", "BUDHA MAGAR SAGAR 10892656"],
    ["9942", "GHARTI SUKUR LAL PA0359051"],
    ["1208", "PRASAD GURU W2457733"],
    ["9939", "HARMEET W7371998"],
    ["9938", "JASBIR SINGH B9179003"],
    ["9937", "SUKHWANAT SINGH U9313655"],
    ["9926", "SARBU RAZVAN"],
    ["9933", "GROZA VASI"],
    ["9935", "DALVINDER KUMAR S7049898"],
    ["9924", "SAHIL KUMAR 7011005320039"],
    ["9932", "ILIE DUMITRU"],
    ["9925", "GHERGHEL SORIN"],
    ["9927", "TĂTĂRĂSCU ADRIAN"],
    ["9928", "REBEGEL MIHAI"],
    ["1177", "SÂRBU MIRCEA"],
    ["9931", "SUNNY KUMAR 7880714400069"],
    ["9934", "DALVIR SINGH W6452456"],
    ["4384", "AMANDEEP 7910310130052 W3340414"],
    ["1170", "AJAY KUMAR U9027135"],
    ["1188", "AMANDEEP AE930112/N3843789"],
    ["1191", "BALJINDER SINGH R3487932"],
    ["1194", "GAUTAM PRAKASH PA3820581"],
    ["1180", "KUMAR RAKESH X9761522"],
    ["1187", "NEPALI SURAJ PA3007870"],
    ["1190", "PRASAD GURU W2457733"],
    ["1193", "DAVINDER SINGH"],
    ["1181", "JASVIR SINGH"],
    ["1169", "JATINDER SINGH"],
    ["1176", "KULBIR SINGH"],
    ["1197", "LAKHWINDER SINGH"],
    ["1171", "MANJINDER SINGH"],
    ["1158", "PARAMJIT RAM"],
    ["1175", "PARWINDER SINGH AK528327/P5084150"],
    ["1186", "RAMAN KUMAR"],
    ["1173", "SANDEEP SINGH T9159351"],
    ["1196", "SONU R2412784"],
    ["1178", "VIJAY KUMAR"],
    ["1184", "RATA ALEXANDRU"],
    ["1157", "MOLDOVAN FLAVIU IULIAN"]
  ];
  const rezultate = {
    exit: [],
    altceva: [],
    erori: []
  };
  console.log(
    `Pornire DEPONTARE: ${angajati.length} angajați | ${DATA_IESIRE} | ${SANTIER}`
  );
  for (const [pin, nume] of angajati) {
    try {
      const response = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uid: `PONTAJ-ANGULAR-${pin}-20260817-1530`,
          tag_type: "nfc",
          content: pin,
          timestamp: DATA_IESIRE,
          worksite: SANTIER
        })
      });
      const text = await response.text();
      let rezultat;
      try {
        rezultat = JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      if (!response.ok || rezultat.ok === false) {
        throw new Error(JSON.stringify(rezultat));
      }
      if (rezultat.state === "EXIT") {
        rezultate.exit.push({ pin, nume });
        console.log(`EXIT OK | ${nume} | PIN ${pin}`);
      } else {
        rezultate.altceva.push({ pin, nume, raspuns: rezultat });
        console.warn(
          `ATENȚIE: A RĂSPUNS ${rezultat.state} | ${nume} | PIN ${pin}`
        );
      }
    } catch (eroare) {
      rezultate.erori.push({
        pin,
        nume,
        eroare: String(eroare)
      });
      console.error(`EROARE | ${nume} | PIN ${pin}`, eroare);
    }
    // Pauză mică pentru a nu trimite toate cererile simultan
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log("===== REZULTAT FINAL =====");
  console.log(`EXIT reușit: ${rezultate.exit.length}`);
  console.log(`Au răspuns altceva (nu EXIT): ${rezultate.altceva.length}`);
  console.log(`Erori: ${rezultate.erori.length}`);
  if (rezultate.altceva.length) {
    console.warn("ANGAJAȚI CARE NU AU RĂSPUNS EXIT:");
    console.table(rezultate.altceva);
  }
  if (rezultate.erori.length) {
    console.error("ERORI:");
    console.table(rezultate.erori);
  }
  window.rezultateDepontaj = rezultate;
})();
