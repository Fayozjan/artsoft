import { readFileSync, writeFileSync } from "fs";

const files = {
  ru: "client/src/locales/ru.json",
  en: "client/src/locales/en.json",
  uzLatn: "client/src/locales/uzLatn.json",
  uzCyrl: "client/src/locales/uzCyrl.json",
};

const keys = {
  localDevice: { ru: "Локальное устройство", en: "Local device", uzLatn: "Mahalliy qurilma", uzCyrl: "Маҳаллий қурилма" },
  receiveLate: { ru: "Получать опоздавших", en: "Receive late employees", uzLatn: "Kechikganlarni qabul qilish", uzCyrl: "Кечикганларни қабул қилиш" },
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
