import { readFileSync, writeFileSync } from "fs";

const files = {
  ru: "client/src/locales/ru.json",
  en: "client/src/locales/en.json",
  uzLatn: "client/src/locales/uzLatn.json",
  uzCyrl: "client/src/locales/uzCyrl.json",
};

const keys = {
  terminateEvent: { ru: "Увольнение", en: "Termination", uzLatn: "Ishdan boʻshatish", uzCyrl: "Ишдан бўшатиш" },
  byBranch: { ru: "Отдельно по филиалу", en: "By branch", uzLatn: "Filial bo'yicha", uzCyrl: "Филиал бўйича" },
  viewMode: { ru: "Режим отображения", en: "View mode", uzLatn: "Ko'rinish rejimi", uzCyrl: "Кўриниш режими" },
  ignoreGpsCheck: { ru: "Игнорировать GPS-проверку", en: "Ignore GPS check", uzLatn: "GPS tekshiruvini e'tiborsiz qoldirish", uzCyrl: "GPS текширувини эътиборсиз қолдириш" },
  personalMenuMode: { ru: "Личный режим для меню", en: "Personal menu mode", uzLatn: "Menyu uchun shaxsiy rejim", uzCyrl: "Меню учун шахсий режим" },
  lateDetailsTitle: { ru: "Подробности опозданий", en: "Late details", uzLatn: "Kechikishlar tafsiloti", uzCyrl: "Кечикишлар тафсилоти" },
  lateForMonth: { ru: "Опозданий за месяц", en: "Late occurrences this month", uzLatn: "Oy davomida kechikishlar", uzCyrl: "Ой давомида кечикишлар" },
  onlyExitRecorded: { ru: "Зафиксирован только выход", en: "Only exit recorded", uzLatn: "Faqat chiqish qayd etilgan", uzCyrl: "Фақат чиқиш қайд этилган" },
  deleteRecord: { ru: "Удалить запись?", en: "Delete record?", uzLatn: "Yozuvni o'chirish?", uzCyrl: "Ёзувни ўчириш?" },
  returnedLabel: { ru: "Вернулся", en: "Returned", uzLatn: "Qaytdi", uzCyrl: "Қайтди" },
  breakLateLabel: { ru: "Опозд. перерыв", en: "Break late", uzLatn: "Tanaffus kechikish", uzCyrl: "Танаффус кечикиш" },
  schedBreakEnd: { ru: "Перерыв по", en: "Break until", uzLatn: "Tanaffus tugashi", uzCyrl: "Танаффус тугаши" },
  yearsOld: { ru: "лет", en: "years old", uzLatn: "yosh", uzCyrl: "ёш" },
  daysRemaining: { ru: "дн. осталось", en: "days left", uzLatn: "kun qoldi", uzCyrl: "кун қолди" },
  todayBirthdayLabel: { ru: "сегодня", en: "today", uzLatn: "bugun", uzCyrl: "бугун" },
  untilLabel: { ru: "до", en: "until", uzLatn: "gacha", uzCyrl: "гача" },
  order: { ru: "Приказ", en: "Order", uzLatn: "Buyruq", uzCyrl: "Буйруқ" },
  lateTimeHhMm: { ru: "Опоздание (чч:мм)", en: "Late (hh:mm)", uzLatn: "Kechikish (ss:dd)", uzCyrl: "Кечикиш (сс:дд)" },
  scheduledTime: { ru: "По графику", en: "Scheduled", uzLatn: "Jadval bo'yicha", uzCyrl: "Жадвал бўйича" },
  employeeCount2: { ru: "Количество сотрудников", en: "Employee count", uzLatn: "Xodimlar soni", uzCyrl: "Ходимлар сони" },
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
