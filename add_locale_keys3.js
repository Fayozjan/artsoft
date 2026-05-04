import { readFileSync, writeFileSync } from "fs";

const files = {
  ru: "client/src/locales/ru.json",
  en: "client/src/locales/en.json",
  uzLatn: "client/src/locales/uzLatn.json",
  uzCyrl: "client/src/locales/uzCyrl.json",
};

const keys = {
  remote: { ru: "Дистанционный", en: "Remote", uzLatn: "Masofaviy", uzCyrl: "Масофавий" },
  weeklyHoursNorm: { ru: "Норма часов в неделю", en: "Weekly hours norm", uzLatn: "Haftada soatlar normasi", uzCyrl: "Ҳафтада соатлар нормаси" },
  workWeek: { ru: "Рабочая неделя", en: "Work week", uzLatn: "Ish haftasi", uzCyrl: "Иш ҳафтаси" },
  days: { ru: "дн.", en: "days", uzLatn: "kun", uzCyrl: "кун" },
  end: { ru: "Конец", en: "End", uzLatn: "Tugash", uzCyrl: "Тугаш" },
  breakFrom: { ru: "Перерыв с", en: "Break from", uzLatn: "Tanaffus boshlanishi", uzCyrl: "Танаффус бошланиши" },
  shiftStart: { ru: "Начало смены", en: "Shift start", uzLatn: "Smenaning boshlanishi", uzCyrl: "Сменанинг бошланиши" },
  shiftEnd: { ru: "Конец смены", en: "Shift end", uzLatn: "Smenaning tugashi", uzCyrl: "Сменанинг тугаши" },
  shiftBreakFrom: { ru: "Перерыв смены с", en: "Shift break from", uzLatn: "Smenada tanaffus boshlanishi", uzCyrl: "Сменада танаффус бошланиши" },
  shiftBreakTo: { ru: "Перерыв смены по", en: "Shift break until", uzLatn: "Smenada tanaffus tugashi", uzCyrl: "Сменада танаффус тугаши" },
  lateToleranceMin: { ru: "Допуск опоздания (ми��)", en: "Late tolerance (min)", uzLatn: "Kechikish chegarasi (daq)", uzCyrl: "Кечикиш чегараси (дақ)" },
  earlyLeaveToleranceMin: { ru: "Допуск раннего ухода (мин)", en: "Early leave tolerance (min)", uzLatn: "Erta ketish chegarasi (daq)", uzCyrl: "Эрта кетиш чегараси (дақ)" },
  lateLeaveToleranceMin: { ru: "Допуск позднего ухода (мин)", en: "Late leave tolerance (min)", uzLatn: "Kech ketish chegarasi (daq)", uzCyrl: "Кеч кетиш чегараси (дақ)" },
  totalWeeklyHours: { ru: "Всего часов в неделю", en: "Total weekly hours", uzLatn: "Haftada jami soatlar", uzCyrl: "Ҳафтада жами соатлар" },
  exceedsHoursLimit: { ru: "Превышает норму часов!", en: "Exceeds hours limit!", uzLatn: "Soatlar normasidan oshadi!", uzCyrl: "Соатлар норmasidan oshadi!" },
  hoursExceedLimit: { ru: "Суммарные часы превышают норму!", en: "Total hours exceed the limit!", uzLatn: "Jami soatlar normadan oshadi!", uzCyrl: "Жами соатлар normadan oshadi!" },
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
