import { readFileSync, writeFileSync } from "fs";

const files = {
  ru: "client/src/locales/ru.json",
  en: "client/src/locales/en.json",
  uzLatn: "client/src/locales/uzLatn.json",
  uzCyrl: "client/src/locales/uzCyrl.json",
};

const keys = {
  closeConfirmTitle: { ru: "Вы уверены, что хотите закрыть окно?", en: "Are you sure you want to close?", uzLatn: "Oynani yopishga ishonchingiz komilmi?", uzCyrl: "Ойнани ёпишга ишончингиз комилми?" },
  unsavedDataLost: { ru: "Несохранённые данные будут потеряны.", en: "Unsaved data will be lost.", uzLatn: "Saqlanmagan ma'lumotlar yo'qoladi.", uzCyrl: "Сақланмаган маълумотлар йўқолади." },
  addRecord: { ru: "Добавление", en: "Add", uzLatn: "Qo'shish", uzCyrl: "Қўшиш" },
  inProcess: { ru: "В обработке", en: "In process", uzLatn: "Jarayonda", uzCyrl: "Жараёнда" },
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
