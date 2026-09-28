"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type SupportedLanguage = "en" | "hi" | "or" | "bn" | "te" | "ta";

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
];

export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Navigation
    live_monitoring: "Live Monitoring",
    classification: "Classification",
    historical_archive: "Historical Archive",
    storm_comparison: "Storm Comparison",
    track_forecast: "Track Forecast",
    alerts_reports: "Alerts & Reports",
    settings: "Settings",

    // Alert Levels
    red_alert: "RED ALERT: Landfall Warning",
    orange_alert: "ORANGE ALERT: Cyclone Alert",
    yellow_alert: "YELLOW WATCH: Cyclone Watch",
    green_nominal: "GREEN: Normal Surveillance",

    // Metrics
    active_cyclone: "Active Cyclone System",
    wind_speed: "Max Sustained Wind",
    central_pressure: "Central Pressure",
    est_landfall: "Estimated Landfall",
    storm_surge: "Storm Surge Inundation",
    coastal_crossing: "Coastal Crossing Fix",
    cone_uncertainty: "Cone of Uncertainty",
    infra_exposure: "Infra Exposure",

    // Advisories
    fishermen_warning: "Total suspension of fishing operations along coastal waters.",
    evacuation_notice: "Mandatory coastal evacuation active for vulnerable low-lying zones.",
    power_grid_advisory: "Precautionary power grid isolation ordered in surge inundation belt.",
    shelter_capacity: "Cyclone shelters and emergency relief camps operational 24x7.",
    disaster_hotline: "Emergency NDMA Disaster Response Hotline: 1070 / 1077",
  },
  hi: {
    // Navigation
    live_monitoring: "लाइव निगरानी",
    classification: "चक्रवात वर्गीकरण",
    historical_archive: "ऐतिहासिक संग्रह",
    storm_comparison: "तूफान तुलना",
    track_forecast: "मार्ग पूर्वानुमान",
    alerts_reports: "चेतावनी एवं रिपोर्ट",
    settings: "सेटिंग्स",

    // Alert Levels
    red_alert: "रेड अलर्ट: लैंडफॉल चेतावनी",
    orange_alert: "ऑरेंज अलर्ट: चक्रवात चेतावनी",
    yellow_alert: "येलो अलर्ट: पूर्व-चक्रवात निगरानी",
    green_nominal: "ग्रीन: सामान्य निगरानी",

    // Metrics
    active_cyclone: "सक्रिय चक्रवाती प्रणाली",
    wind_speed: "अधिकतम निरंतर हवा",
    central_pressure: "केंद्रीय वायुदाब",
    est_landfall: "अनुमानित लैंडफॉल समय",
    storm_surge: "तूफानी लहर जलभराव",
    coastal_crossing: "तटीय लैंडफॉल बिंदु",
    cone_uncertainty: "अनिश्चितता का दायरा",
    infra_exposure: "बुनियादी ढांचा जोखिम",

    // Advisories
    fishermen_warning: "तटीय क्षेत्रों में मत्स्य पालन कार्यों पर पूर्ण प्रतिबंध लागू।",
    evacuation_notice: "निचले तटीय इलाकों से नागरिकों को तुरंत सुरक्षित स्थानों पर पहुंचाएं।",
    power_grid_advisory: "बाढ़ संभावित तटीय क्षेत्रों में विद्युत ग्रिड एहतियातन बंद किए गए।",
    shelter_capacity: "चक्रवात आश्रय गृह 24 घंटे सक्रिय और आपातकालीन राशन से लैस हैं।",
    disaster_hotline: "राष्ट्रीय आपदा प्रबंधन हेल्पलाइन: 1070 / 1077",
  },
  or: {
    // Navigation
    live_monitoring: "ପ୍ରତ୍ୟକ୍ଷ ନଜର (ଲାଇଭ୍)",
    classification: "ବାତ୍ୟା ବର୍ଗୀକରଣ",
    historical_archive: "ଐତିହାସିକ ରେକର୍ଡ",
    storm_comparison: "ବାତ୍ୟା ତୁଳନା",
    track_forecast: "ପଥ ପୂର୍ବାନୁମାନ",
    alerts_reports: "ଚେତାବନୀ ଓ ରିପୋର୍ଟ",
    settings: "ସେଟିଂସ୍",

    // Alert Levels
    red_alert: "ଲାଲ୍ ଚେତାବନୀ: ଲ୍ୟାଣ୍ଡଫଲ୍ ସତର୍କତା",
    orange_alert: "କମଳା ଚେତାବନୀ: ବାତ୍ୟା ସତର୍କତା",
    yellow_alert: "ହଳଦିଆ ଚେତାବନୀ: ପ୍ରାକ୍-ବାତ୍ୟା ନଜର",
    green_nominal: "ସବୁଜ: ସାଧାରଣ ନିରୀକ୍ଷଣ",

    // Metrics
    active_cyclone: "ସକ୍ରିୟ ବାତ୍ୟା ପ୍ରଣାଳୀ",
    wind_speed: "ସର୍ବାଧିକ ପବନର ବେଗ",
    central_pressure: "କେନ୍ଦ୍ରୀୟ ବାୟୁଚାପ",
    est_landfall: "ଆନୁମାନିକ ଲ୍ୟାଣ୍ଡଫଲ୍ ସମୟ",
    storm_surge: "ଜୁଆର ତରଙ୍ଗ ଜଳପ୍ଳାବନ",
    coastal_crossing: "ଉପକୂଳ ଅତିକ୍ରମଣ ବିନ୍ଦୁ",
    cone_uncertainty: "ଅନିଶ୍ଚିତତା ବଳୟ",
    infra_exposure: "ମୌଳିକ ସୁବିଧା ବିପଦ",

    // Advisories
    fishermen_warning: "ମତ୍ସ୍ୟଜୀବୀମାନଙ୍କୁ ସମୁଦ୍ର ମଧ୍ୟକୁ ଯିବା ଉପରେ ସମ୍ପୂର୍ଣ୍ଣ କଟକଣା।",
    evacuation_notice: "ତଳିଆ ଉପକୂଳ ଅଞ୍ଚଳରୁ ବାତ୍ୟା ଆଶ୍ରୟସ୍ଥଳୀକୁ ସ୍ଥାନାନ୍ତର ଆରମ୍ଭ।",
    power_grid_advisory: "ଜୁଆର ଆଶଙ୍କା ଥିବା ଅଞ୍ଚଳରେ ବିଦ୍ୟୁତ ସରବରାହ ସତର୍କତାମୂଳକ ବନ୍ଦ।",
    shelter_capacity: "ଓଡ୍ରାଫ୍ ଓ ଏନଡିଆରଏଫ୍ ଟିମ୍ ଉପକୂଳ ଜିଲ୍ଲାଗୁଡ଼ିକରେ ମୁତୟନ।",
    disaster_hotline: "ଓଡ଼ିଶା ରାଜ୍ୟ ବିପର୍ଯ୍ୟୟ ପରିଚାଳନା ହେଲ୍ପଲାଇନ୍: 1070 / 1077",
  },
  bn: {
    // Navigation
    live_monitoring: "লাইভ পর্যবেক্ষণ",
    classification: "ঘূর্ণিঝড় শ্রেণিবিন্যাস",
    historical_archive: "ঐতিহাসিক রেকর্ড",
    storm_comparison: "ঝড় তুলনা",
    track_forecast: "গতিপথ পূর্বাভাস",
    alerts_reports: "সতর্কবার্তা ও রিপোর্ট",
    settings: "সেটিংস",

    // Alert Levels
    red_alert: "লাল সতর্কতা: ল্যান্ডফল সতর্কতা",
    orange_alert: "কমলা সতর্কতা: ঘূর্ণিঝড় সতর্কতা",
    yellow_alert: "হলুদ সতর্কতা: প্রাথমিক নজরদারি",
    green_nominal: "সবুজ: স্বাভাবিক নজরদারি",

    // Metrics
    active_cyclone: "সক্রিয় ঘূর্ণিঝড় ব্যবস্থা",
    wind_speed: "সর্বোচ্চ বাতাসের গতিবেগ",
    central_pressure: "কেন্দ্রীয় বায়ুর চাপ",
    est_landfall: "সম্ভাব্য ল্যান্ডফল সময়",
    storm_surge: "জলোচ্ছ্বাসের উচ্চতা",
    coastal_crossing: "উপকূল অতিক্রমণ বিন্দু",
    cone_uncertainty: "অনিশ্চয়তার শঙ্কু",
    infra_exposure: "পরিকাঠামো ঝুঁকি",

    // Advisories
    fishermen_warning: "উপকূলবর্তী সমুদ্রে সকল মাছ ধরার ট্রলার চলাচল সম্পূর্ণ বন্ধ।",
    evacuation_notice: "সুন্দরবন ও নিচু উপকূলীয় এলাকা থেকে নিরাপদ আশ্রয়ে দ্রুত স্থানান্তর।",
    power_grid_advisory: "উপকূলীয় বিপজ্জনক সাবস্টেশনগুলিতে আগাম বিদ্যুৎ নিয়ন্ত্রণ চালু।",
    shelter_capacity: "সকল সাইক্লোন শেল্টার ও জরুরি মেডিকেল টিম ২৪ ঘণ্টা প্রস্তুত।",
    disaster_hotline: "পশ্চিমবঙ্গ বিপর্যয় মোকাবিলা হেল্পলাইন: 1070 / 1077",
  },
  te: {
    // Navigation
    live_monitoring: "లైవ్ పర్యవేక్షణ",
    classification: "తుఫాను వర్గీకరణ",
    historical_archive: "చారిత్రక రికార్డులు",
    storm_comparison: "తుఫానుల పోలిక",
    track_forecast: "మార్గ సూచన",
    alerts_reports: "హెచ్చరికలు & నివేదికలు",
    settings: "సెట్టింగులు",

    // Alert Levels
    red_alert: "రెడ్ అలర్ట్: తీరం దాటే హెచ్చరిక",
    orange_alert: "ఆరెంజ్ అలర్ట్: తుఫాను హెచ్చరిక",
    yellow_alert: "ఎల్లో అలర్ట్: ముందస్తు నిఘా",
    green_nominal: "గ్రీన్: సాధారణ పర్యవేక్షణ",

    // Metrics
    active_cyclone: "ప్రస్తుత తుఫాను వ్యవస్థ",
    wind_speed: "గరిష్ట స్థిరమైన గాలి వేగం",
    central_pressure: "కేంద్ర వాయు పీడనం",
    est_landfall: "తీరం దాటే సమయం",
    storm_surge: "సముద్రపు అలల ఉధృతి",
    coastal_crossing: "తీరం దాటే ప్రాంతం",
    cone_uncertainty: "అనిశ్చితి విస్తీర్ణం",
    infra_exposure: "మౌలిక వసతుల ప్రమాదం",

    // Advisories
    fishermen_warning: "తీర ప్రాంత మత్స్యకారులు సముద్రంలోకి వేటకు వెళ్లరాదు.",
    evacuation_notice: "తీరప్రాంత లోతట్టు గ్రామాల ప్రజలను సురక్షిత పునరావాస కేంద్రాలకు తరలింపు.",
    power_grid_advisory: "తుఫాను ప్రభావ ప్రాంతాలలో ముందుజాగ్రత్తగా విద్యుత్ నిలిపివేత.",
    shelter_capacity: "పునరావాస కేంద్రాలలో తగినంత ఆహారం మరియు తాగునీరు సిద్ధం.",
    disaster_hotline: "ఆంధ్రప్రదేశ్ విపత్తు నిర్వహణ హెల్ప్‌లైన్: 1070 / 1077",
  },
  ta: {
    // Navigation
    live_monitoring: "நேரலை கண்காணிப்பு",
    classification: "புயல் வகைப்பாடு",
    historical_archive: "வரலாற்று காப்பகம்",
    storm_comparison: "புயல்கள் ஒப்பீடு",
    track_forecast: "பாதை முன்னறிவிப்பு",
    alerts_reports: "எச்சரிக்கைகள் & அறிக்கைகள்",
    settings: "அமைப்புகள்",

    // Alert Levels
    red_alert: "சிவப்பு எச்சரிக்கை: கரையை கடக்கும் எச்சரிக்கை",
    orange_alert: "ஆரஞ்சு எச்சரிக்கை: புயல் எச்சரிக்கை",
    yellow_alert: "மஞ்சள் எச்சரிக்கை: முன் எச்சரிக்கை",
    green_nominal: "பச்சை: இயல்பான கண்காணிப்பு",

    // Metrics
    active_cyclone: "செயலில் உள்ள புயல் அமைப்பு",
    wind_speed: "அதிகபட்ச காற்றின் வேகம்",
    central_pressure: "மத்திய காற்று அழுத்தம்",
    est_landfall: "கரையை கடக்கும் நேரம்",
    storm_surge: "கடல் அலை சீற்றம்",
    coastal_crossing: "கரையை கடக்கும் இடம்",
    cone_uncertainty: "நிச்சயமற்ற தன்மை பகுதி",
    infra_exposure: "உள்கட்டமைப்பு பாதிப்பு",

    // Advisories
    fishermen_warning: "மீனவர்கள் கடலுக்கு செல்ல வேண்டாம் என முழுமையான தடை.",
    evacuation_notice: "கடலோர தாழ்வான பகுதிகளில் உள்ள மக்கள் நிவாரண முகாம்களுக்கு மாற்றம்.",
    power_grid_advisory: "பாதிக்கப்படும் பகுதிகளில் முன்னெச்சரிக்கை மின் தடை.",
    shelter_capacity: "அனைத்து புயல் நிவாரண முகாம்களும் 24 மணி நேரமும் தயார் நிலையில்.",
    disaster_hotline: "தமிழ்நாடு பேரிடர் மேலாண்மை உதவி எண்: 1070 / 1077",
  },
};

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cyclonet_language") as SupportedLanguage;
      if (stored && TRANSLATIONS[stored]) {
        setLanguageState(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("cyclonet_language", lang);
    } catch {
      // ignore
    }
  };

  const t = (key: string): string => {
    const langDict = TRANSLATIONS[language];
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    // Fallback to English
    return TRANSLATIONS.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
