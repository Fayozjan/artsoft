import { readFileSync, writeFileSync } from "fs";

const files = {
  ru: "client/src/locales/ru.json",
  en: "client/src/locales/en.json",
  uzLatn: "client/src/locales/uzLatn.json",
  uzCyrl: "client/src/locales/uzCyrl.json",
};

const keys = {
  workScheduleTitle: { ru: "Рабочий график", en: "Work schedule", uzLatn: "Ish grafigi", uzCyrl: "Иш графиги" },
  presentToDate: { ru: "по настоящее время", en: "to present", uzLatn: "hozirgi kungacha", uzCyrl: "ҳозирги кунгача" },
  assigned: { ru: "Назначен", en: "Assigned", uzLatn: "Tayinlangan", uzCyrl: "Тайинланган" },
  workMode: { ru: "Режим работы", en: "Work mode", uzLatn: "Ish rejimi", uzCyrl: "Иш режими" },
  scheduleName: { ru: "Название", en: "Name", uzLatn: "Nomi", uzCyrl: "Номи" },
  shift2Label: { ru: "смена", en: "shift", uzLatn: "smena", uzCyrl: "смена" },
};

for (const [lang, filePath] of Object.entries(files)) {
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  for (const [key, translations] of Object.entries(keys)) {
    if (!(key in data)) {
      data[key] = translations[lang] ?? translations.en;
    }
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Updated ${filePath}`);
}
