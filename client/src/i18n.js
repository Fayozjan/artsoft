import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import uz from "./locales/uz.json";
import uzCyrl from "./locales/uzCyrl.json";
import ru from "./locales/ru.json";
import en from "./locales/en.json";

const savedLang = localStorage.getItem("language");

i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    uzCyrl: { translation: uzCyrl },
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: "ru",
  interpolation: { escapeValue: false },
});

export default i18n;
