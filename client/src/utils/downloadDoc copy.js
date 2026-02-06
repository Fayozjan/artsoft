import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  TabStopType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";

function formatDate(dateString) {
  const date = new Date(dateString);

  // Смещение часового пояса (если надо под Узбекистан)
  const localDate = new Date(date.getTime() + 5 * 60 * 60 * 1000); // UTC+5

  const day = localDate.getDate();
  const month = localDate.getMonth(); // 0-11
  const year = localDate.getFullYear();

  const uzbekMonths = [
    "январ",
    "феврал",
    "март",
    "апрел",
    "май",
    "июн",
    "июл",
    "август",
    "сентябр",
    "октябр",
    "ноябр",
    "декабр",
  ];

  return `${day} ${uzbekMonths[month]} ${year} й.`;
}

function formatFullDate(dateString) {
  const date = new Date(dateString);

  // Если нужен переход в ташкентское время (UTC+5):
  const localDate = new Date(date.getTime() + 5 * 60 * 60 * 1000);

  const day = localDate.getDate();
  const month = localDate.getMonth(); // 0-11
  const year = localDate.getFullYear();

  const uzbekMonths = [
    "январ",
    "феврал",
    "март",
    "апрел",
    "май",
    "июн",
    "июл",
    "август",
    "сентябр",
    "октябр",
    "ноябр",
    "декабр",
  ];

  return `${year} йил ${day} ${uzbekMonths[month]}`;
}

function uzbekLatinToCyrillic(text) {
  const replacements = [
    // сначала длинные сочетания (с учётом регистра)
    { from: /G`/g, to: "Ғ" },
    { from: /g`/g, to: "ғ" },
    { from: /O`/g, to: "Ў" },
    { from: /o`/g, to: "ў" },
    { from: /Sh/g, to: "Ш" },
    { from: /sh/g, to: "ш" },
    { from: /Ch/g, to: "Ч" },
    { from: /ch/g, to: "ч" },
    { from: /Ya/g, to: "Я" },
    { from: /ya/g, to: "я" },
    { from: /Yo/g, to: "Ё" },
    { from: /yo/g, to: "ё" },
    { from: /Yu/g, to: "Ю" },
    { from: /yu/g, to: "ю" },
    { from: /Ts/g, to: "Ц" },
    { from: /ts/g, to: "ц" },
    { from: /Dj/g, to: "Ж" },
    { from: /dj/g, to: "ж" },

    // одиночные буквы
    { from: /A/g, to: "А" },
    { from: /a/g, to: "а" },
    { from: /B/g, to: "Б" },
    { from: /b/g, to: "б" },
    { from: /D/g, to: "Д" },
    { from: /d/g, to: "д" },
    { from: /E/g, to: "Е" },
    { from: /e/g, to: "е" },
    { from: /F/g, to: "Ф" },
    { from: /f/g, to: "ф" },
    { from: /G/g, to: "Г" },
    { from: /g/g, to: "г" },
    { from: /H/g, to: "Ҳ" },
    { from: /h/g, to: "ҳ" },
    { from: /I/g, to: "И" },
    { from: /i/g, to: "и" },
    { from: /J/g, to: "Ж" },
    { from: /j/g, to: "ж" },
    { from: /K/g, to: "К" },
    { from: /k/g, to: "к" },
    { from: /L/g, to: "Л" },
    { from: /l/g, to: "л" },
    { from: /M/g, to: "М" },
    { from: /m/g, to: "м" },
    { from: /N/g, to: "Н" },
    { from: /n/g, to: "н" },
    { from: /O/g, to: "О" },
    { from: /o/g, to: "о" },
    { from: /P/g, to: "П" },
    { from: /p/g, to: "п" },
    { from: /Q/g, to: "Қ" },
    { from: /q/g, to: "қ" },
    { from: /R/g, to: "Р" },
    { from: /r/g, to: "р" },
    { from: /S/g, to: "С" },
    { from: /s/g, to: "с" },
    { from: /T/g, to: "Т" },
    { from: /t/g, to: "т" },
    { from: /U/g, to: "У" },
    { from: /u/g, to: "у" },
    { from: /V/g, to: "В" },
    { from: /v/g, to: "в" },
    { from: /X/g, to: "Х" },
    { from: /x/g, to: "х" },
    { from: /Y/g, to: "Й" },
    { from: /y/g, to: "й" },
    { from: /Z/g, to: "З" },
    { from: /z/g, to: "з" },
    { from: /`/g, to: "ъ" }, // апостроф
    { from: /`/g, to: "ъ" }, // обычный апостроф
    { from: /`/g, to: "ъ" }, // обратная кавычка
  ];

  let result = text;
  for (const { from, to } of replacements) {
    result = result.replace(from, to);
  }
  return result;
}

export const downloadTransferDoc = async (data, lastHire, userData) => {
  const employeeName = uzbekLatinToCyrillic(
    `${data.surname} ${data.name} ${data.patronymic}`,
  );
  const surname = uzbekLatinToCyrillic(`${data.name[0]}.${data.surname}`);
  const fullDate = formatFullDate(data.event_date);
  const date = formatDate(data.event_date);
  const lastHireDate = formatFullDate(lastHire.event_date);
  const directorName = "А.Мавлонов";
  const directorFullName = "Мавлонов Акбархўжа Юсубхўжаевич";

  const table = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "“ИШ БЕРУВЧИ”",
                    size: 28,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: directorFullName,
                    size: 22,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: "Манзили: Фарғона вилояти Қувасой ш",
                    size: 22,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: "Пакана МФЙ Нурли йўл к.",
                    size: 22,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: "Х/Р 20208000905478889001",
                    size: 22,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: "АТБ Асака Банк, Фарғона вилояти",
                    size: 22,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: "ИНН: 309196518 МФО: 00873",
                    size: 22,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: `_____________    ___ ___________`,
                    size: 24,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: `              (имзо)                                       (сана)`,
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "“ХОДИМ”",
                    size: 28,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: employeeName,
                    size: 22,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: `Манзили: ${userData?.address || ""}`,
                    size: 22,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: `Паспорт серия ва рақами: ${
                      userData?.passport || ""
                    }`,
                    size: 22,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: `ИНПС: ${userData?.pinfl || ""}`,
                    size: 22,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({ break: 1 }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: `_____________    ___ ___________`,
                    size: 22,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: `              (имзо)                                      (сана)`,
                    size: 16,
                  }),
                  new TextRun({ break: 1 }),
                  new TextRun({ break: 1 }),
                  new TextRun({
                    text: `   Мехнат шартномасидан бир нусха олдим  ___________`,
                    size: 17,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 709, // 1.25 см
              bottom: 851, // 1.5 см
              left: 1701, // 3 см
              right: 851, // 1.5 см
            },
          },
        },
        children: [
          // Первая страница
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "«KRISTOFF CERAMICS»",
                bold: true,
                size: 64,
                color: "#0000ff",
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 150 },
            children: [
              new TextRun({
                text: "М А Ъ С У Л И Я Т И    Ч Е К Л А Н Г А Н    Ж А М И Я Т И",
                size: 28,
                color: "#0000ff",
                bold: true,
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            border: {
              top: { color: "#0000ff", space: 1, size: 14, style: "double" },
              bottom: { color: "#0000ff", space: 1, size: 14, style: "double" },
            },
            children: [
              new TextRun({
                text: "B U Y R U Q",
                size: 44,
                font: "Cambria",
                color: "#0000ff",
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            tabStops: [
              { type: TabStopType.LEFT, position: 0 },
              { type: TabStopType.CENTER, position: 4500 },
              { type: TabStopType.RIGHT, position: 9000 },
            ],
            children: [
              new TextRun({
                text: `«${date}»`,
                color: "#ff0000",
                size: 26,
                bold: true,
                font: "Times New Roman",
              }),
              new TextRun({
                text: `\t№ ${data.order_number}`,
                size: 28,
                bold: true,
                font: "Times New Roman",
              }),
              new TextRun({
                text: "\tКувасой шахар",
                size: 26,
                bold: true,
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: "“Ходимни доимий бошка ишга",
                bold: true,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: "           ўтказиш тўғрисида”",
                bold: true,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `\t1. ${employeeName} – “KRISTOFF CERAMICS” маъсуляти чекланган жамиятнинг ${lastHire.department_name} ${lastHire.position_name} вазифасидан ${fullDate} кунидан ${data.department_name} ${data.position_name} вазифасига ўтказилсин.`,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `\tХодимнинг ${data.department_name} ${data.position_name} вазифасига кириш санаси ${fullDate} куни деб белгилансин.`,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `\tАсос: Ходимнинг аризаси, Ў.Р. Мехнат Кодексининг 140,149-моддалари, ${employeeName}ни розилиги ва тузилган меҳнат шартномасига ўзгартириш киритиш ҳақидаги ${fullDate} кунидаги келишув.`,
                size: 28,
                italics: true,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 600 },
            children: [
              new TextRun({
                text: "«KRISTOFF CERAMICS»",
                size: 28,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
            children: [
              new TextRun({
                text: "        МЧЖ директори:\t" + directorName,
                size: 28,
                bold: true,
              }),
            ],
          }),

          // Вторая страница
          new Paragraph({
            pageBreakBefore: true,
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${lastHireDate} ${lastHire.order_number} - сонли мехнат шартномаси буйича`,
                size: 28,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({
                text: "1 - сонли кушимча келишув",
                size: 28,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 400, after: 300 },
            children: [
              new TextRun({
                text: date,
                size: 28,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `       «KRISTOFF CERAMICS» МЧЖ номидан устав асосида харакат килувчи жамият директори  Мавлонов Акбархўжа Юсубхўжаевич (куйида Иш берувчи) ва ${lastHire.department_name} ${lastHire.position_name} ${employeeName} (куйида Ходим), биргаликда “тарафлар” деб юритилади, ушбу кўшимча келишувни куйидаги мазмунда туздилар:`,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `       1. Тарафлар ўзаро келишиб, ${lastHireDate} тузилган ${lastHire.order_number} - сонли мехнат шартноманинг 1.1-бандига куйидагича ўзгартириш киритишда келишдилар:`,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: `       1.1-банд. Ходим ${employeeName} ${data.department_name} ${data.position_name} вазифасига кабул килинади.`,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: "       2. Шартноманинг колган бандлари ўзгармай ўз кучида колади.",
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: `       3. Ушбу кўшимча келишув тарафлар уни имзолаганларидан сўнг кучга киради хамда ${lastHireDate} ${lastHire.order_number} - сонли мехнат шартномасининг ажралмас кисмига айланади.`,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: "       4. Мазкур кушимча келишув 2-нусхада тузилиб икки нусхаси хам юридик жихатдан тенг кучга эга.",
                size: 28,
              }),
            ],
          }),
          table,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Перевод ${surname}.docx`);
};

export const downloadTerminationDoc = async (data, lastHire) => {
  const employeeName = uzbekLatinToCyrillic(
    `${data.surname} ${data.name} ${data.patronymic}`,
  );
  const surname = uzbekLatinToCyrillic(`${data.name[0]}.${data.surname}`);
  const fullDate = formatFullDate(data.event_date);
  const date = formatDate(data.event_date);
  const lastHireDate = formatFullDate(lastHire.event_date);

  const directorName = "А.Мавлонов";

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 500, // 1.25 см
              bottom: 851, // 1.5 см
              left: 1701, // 3 см
              right: 851, // 1.5 см
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "«KRISTOFF CERAMICS»",
                bold: true,
                size: 64,
                color: "#0000ff",
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 150 },
            children: [
              new TextRun({
                text: "М А Ъ С У Л И Я Т И    Ч Е К Л А Н Г А Н    Ж А М И Я Т И",
                size: 28,
                color: "#0000ff",
                bold: true,
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            border: {
              top: {
                color: "#0000ff",
                space: 1,
                size: 30,
                style: BorderStyle.THIN_THICK_SMALL_GAP,
              },
              bottom: {
                color: "#0000ff",
                space: 1,
                size: 30,
                style: BorderStyle.THIN_THICK_SMALL_GAP,
              },
            },
            children: [
              new TextRun({
                text: "B U Y R U Q",
                size: 44,
                font: "Cambria",
                color: "#0000ff",
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            tabStops: [
              { type: TabStopType.LEFT, position: 0 },
              { type: TabStopType.CENTER, position: 4500 },
              { type: TabStopType.RIGHT, position: 9000 },
            ],
            children: [
              new TextRun({
                text: `«${date}»`,
                color: "#ff0000",
                size: 26,
                bold: true,
                font: "Times New Roman",
              }),
              new TextRun({
                text: `\t№ ${data.order_number}`,
                size: 28,
                bold: true,
                font: "Times New Roman",
              }),
              new TextRun({
                text: "\tКувасой шахар",
                size: 26,
                bold: true,
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: "“Мехнат шартномасини бекор",
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: "           қилиш тўғрисида”",
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `\t1. «KRISTOFF CERAMICS» маъсулияти чекланган жамиятининг ${lastHire.department_name} ${lastHire.position_name} вазифасида ишловчи ${employeeName} Республикаси Меҳнат кодексининг 155, 157-моддасига биноан, тарафларнинг келишувига кўра ${fullDate} кунидан бекор қилинсин.`,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `\t- Жамият ҳисобхонасига – ${employeeName} ${lastHireDate} кунидан ${fullDate} кунигача ишланган даврда фойдаланилмаган 0 кун меҳнат таътили учун пуллик компенсация ва бошқа тўловларни белгиланган тартибда ҳисоб-китоб қилиш вазифаси топширилсин. (Ўзбекистон Республикаси Меҳнат кодексининг 234-моддаси).`,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 600 },
            children: [
              new TextRun({
                text: "«KRISTOFF CERAMICS»",
                size: 28,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
            children: [
              new TextRun({
                text: "       МЧЖ директори:\t" + directorName,
                size: 28,
                bold: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Уволнение ${surname}.docx`);
};

export const downloadHiredDoc = async (data) => {
  const employeeName = uzbekLatinToCyrillic(
    `${data.surname} ${data.name} ${data.patronymic}`,
  );
  const surname = uzbekLatinToCyrillic(`${data.name[0]}.${data.surname}`);
  const fullDate = formatFullDate(data.event_date);
  const date = formatDate(data.event_date);

  const directorName = "А.Мавлонов";

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: "«KRISTOFF CERAMICS»",
                bold: true,
                size: 64,
                color: "#0000ff",
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 150 },
            children: [
              new TextRun({
                text: "М А Ъ С У Л И Я Т И    Ч Е К Л А Н Г А Н    Ж А М И Я Т И",
                size: 28,
                color: "#0000ff",
                bold: true,
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            border: {
              top: { color: "#0000ff", space: 1, size: 14, style: "double" },
              bottom: { color: "#0000ff", space: 1, size: 14, style: "double" },
            },
            children: [
              new TextRun({
                text: "B U Y R U Q",
                size: 44,
                font: "Cambria",
                color: "#0000ff",
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            tabStops: [
              { type: TabStopType.LEFT, position: 0 },
              { type: TabStopType.CENTER, position: 4500 },
              { type: TabStopType.RIGHT, position: 9000 },
            ],
            children: [
              new TextRun({
                text: `«${date}»`,
                color: "#ff0000",
                size: 26,
                bold: true,
                font: "Times New Roman",
              }),
              new TextRun({
                text: `\t№ ${data.order_number}`,
                size: 28,
                bold: true,
                font: "Times New Roman",
              }),
              new TextRun({
                text: "\tКувасой шахар",
                size: 26,
                bold: true,
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 400, after: 400 },
            children: [
              new TextRun({
                text: "“Ишга қабул қилиш тўғрисида”",
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `\t1.  ${employeeName} - «KRISTOFF CERAMICS» маъсулияти чекланган жамиятининг ${data.department_name} ${data.position_name} вазифасига ${fullDate} кунидан бир ойлик синов муддати билан ишга қабул қилинсин.`,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: "\t- Ходимнинг ойлик маоши штатлар жадвали асосида белгилансин.",
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: `\tАсос: Ўзбекистон Республикасининг Меҳнат кодекси 127-моддаси, ${surname} билан тузилган меҳнат шартномаси.`,
                size: 28,
                italics: true,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 600 },
            children: [
              new TextRun({
                text: "«KRISTOFF  CERAMICS»",
                size: 28,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100 },
            tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
            children: [
              new TextRun({
                text: "МЧЖ директори:\t" + directorName,
                size: 28,
                bold: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Ишга қабул қилиш ${surname}.docx`);
};
