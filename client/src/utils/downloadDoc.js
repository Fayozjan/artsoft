import ExcelJS from "exceljs/dist/exceljs.min.js";
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
import { formatLateMinutesToHours } from "../helpers/time";

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

function formatDate(dateString, full = false) {
  const date = new Date(dateString);
  const localDate = new Date(date.getTime() + 5 * 60 * 60 * 1000); // UTC+5
  const day = localDate.getDate();
  const month = localDate.getMonth();
  const year = localDate.getFullYear();

  return full
    ? `${year} йил ${day} ${uzbekMonths[month]}`
    : `${day} ${uzbekMonths[month]} ${year} й.`;
}

function uzbekLatinToCyrillic(text) {
  const replacements = [
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
    { from: /`/g, to: "ъ" },
  ];
  let result = text;
  replacements.forEach(({ from, to }) => (result = result.replace(from, to)));
  return result;
}

export const DownloadOrder = {
  hire: async (data) => {
    const employeeFullName = uzbekLatinToCyrillic(
      `${data?.employee?.last_name} ${data?.employee?.first_name} ${data?.employee?.middle_name}`,
    );
    const employeeName = uzbekLatinToCyrillic(
      `${data?.employee?.first_name[0]}.${data?.employee?.last_name}`,
    );

    const fullDate = formatDate(data.date, true);
    const date = formatDate(data.date);

    const directorName = uzbekLatinToCyrillic(
      `${data?.branch?.director?.first_name[0]}.${data?.branch?.director?.last_name}`,
    );

    const branchName = data?.branch?.name;
    const branchAddress = uzbekLatinToCyrillic(data?.branch?.address);

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: `«${branchName}»`,
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
                bottom: {
                  color: "#0000ff",
                  space: 1,
                  size: 14,
                  style: "double",
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
                  text: `\t${branchAddress}`,
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
                  text: `\t1.  ${employeeFullName} - «${branchName}» маъсулияти чекланган жамиятининг ${data?.department?.name} ${data?.position?.name} вазифасига ${fullDate} кунидан бир ойлик синов муддати билан ишга қабул қилинсин.`,
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
                  text: `\tАсос: Ўзбекистон Республикасининг Меҳнат кодекси 127-моддаси, ${employeeName} билан тузилган меҳнат шартномаси.`,
                  size: 28,
                  italics: true,
                }),
              ],
            }),
            new Paragraph({
              spacing: { before: 600 },
              children: [
                new TextRun({
                  text: `«${branchName}»`,
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
    saveAs(blob, `Ишга қабул қилиш ${employeeName}.docx`);
  },
  transfer: async (data, lastHire) => {
    const employeeFullName = uzbekLatinToCyrillic(
      `${data?.employee?.last_name} ${data?.employee?.first_name} ${data?.employee?.middle_name}`,
    );
    const employeeName = uzbekLatinToCyrillic(
      `${data?.employee?.first_name[0]}.${data?.employee?.last_name}`,
    );
    const employeeAddress = uzbekLatinToCyrillic(data?.employee?.address);
    const fullDate = formatDate(data.date, true);
    const date = formatDate(data.date);
    const lastHireDate = formatDate(lastHire.date, true);

    const directorFullName = uzbekLatinToCyrillic(
      `${data?.branch?.director?.last_name} ${data?.branch?.director?.first_name} ${data?.branch?.director?.middle_name}`,
    );
    const directorName = uzbekLatinToCyrillic(
      `${data?.branch?.director?.first_name[0]}.${data?.branch?.director?.last_name}`,
    );

    const branchName = data?.branch?.name;
    const branchRegion = uzbekLatinToCyrillic(data?.branch?.region);
    const branchAddress = uzbekLatinToCyrillic(data?.branch?.address);

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
                      text: `Манзили: ${branchAddress}`,
                      size: 22,
                    }),
                    new TextRun({ break: 1 }),
                    new TextRun({
                      text: `Х/Р ${data?.branch?.bank_account}`,
                      size: 22,
                    }),
                    new TextRun({ break: 1 }),
                    new TextRun({
                      text: `${data?.branch?.bank_name}`,
                      size: 22,
                    }),
                    new TextRun({ break: 1 }),
                    new TextRun({
                      text: `ИНН: ${data?.branch?.inn} МФО: ${data?.branch?.mfo}`,
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
                      text: employeeFullName,
                      size: 22,
                    }),
                    new TextRun({ break: 1 }),
                    new TextRun({
                      text: `Манзили: ${employeeAddress || ""}`,
                      size: 22,
                    }),
                    new TextRun({ break: 1 }),
                    new TextRun({
                      text: `Паспорт серия ва рақами: ${
                        data?.employee?.passport || ""
                      }`,
                      size: 22,
                    }),
                    new TextRun({ break: 1 }),
                    new TextRun({
                      text: `ИНПС: ${data?.employee?.pinfl || ""}`,
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
                top: 709,
                bottom: 851,
                left: 1701,
                right: 851,
              },
            },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `«${branchName}»`,
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
                bottom: {
                  color: "#0000ff",
                  space: 1,
                  size: 14,
                  style: "double",
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
                  text: `\t${branchRegion}`,
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
                  text: `\t1. ${employeeFullName} – “${branchName}” маъсуляти чекланган жамиятнинг ${lastHire.department.name} ${lastHire.position.name} вазифасидан ${fullDate} кунидан ${data.department.name} ${data.position.name} вазифасига ўтказилсин.`,
                  size: 28,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              children: [
                new TextRun({
                  text: `\tХодимнинг ${data.department.name} ${data.position.name} вазифасига кириш санаси ${fullDate} куни деб белгилансин.`,
                  size: 28,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              children: [
                new TextRun({
                  text: `\tАсос: Ходимнинг аризаси, Ў.Р. Мехнат Кодексининг 140,149-моддалари, ${employeeFullName}ни розилиги ва тузилган меҳнат шартномасига ўзгартириш киритиш ҳақидаги ${fullDate} кунидаги келишув.`,
                  size: 28,
                  italics: true,
                }),
              ],
            }),
            new Paragraph({
              spacing: { before: 600 },
              children: [
                new TextRun({
                  text: `«${branchName}»`,
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
                  text: `       «${branchName}» МЧЖ номидан устав асосида харакат килувчи жамият директори ${directorFullName} (куйида Иш берувчи) ва ${lastHire.department.name} ${lastHire.position.name} ${employeeFullName} (куйида Ходим), биргаликда “тарафлар” деб юритилади, ушбу кўшимча келишувни куйидаги мазмунда туздилар:`,
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
                  text: `       1.1-банд. Ходим ${employeeFullName} ${data.department.name} ${data.position.name} вазифасига кабул килинади.`,
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
    saveAs(blob, `Перевод ${employeeName}.docx`);
  },
  terminate: async (data, lastHire, lastOrder) => {
    const employeeFullName = uzbekLatinToCyrillic(
      `${data?.employee?.last_name} ${data?.employee?.first_name} ${data?.employee?.middle_name}`,
    );
    const employeeName = uzbekLatinToCyrillic(
      `${data?.employee?.first_name[0]}.${data?.employee?.last_name}`,
    );

    const fullDate = formatDate(data.date, true);
    const date = formatDate(data.date);
    const lastHireDate = formatDate(lastHire.date, true);

    const branchName = lastHire?.branch?.name;
    const branchRegion = uzbekLatinToCyrillic(lastHire?.branch?.region);
    const directorName = uzbekLatinToCyrillic(
      `${lastHire?.branch?.director?.first_name[0]}.${lastHire?.branch?.director?.last_name}`,
    );

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
                  text: `«${branchName}»`,
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
                  text: `\t${branchRegion}`,
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
                  text: `\t1. «${branchName}» маъсулияти чекланган жамиятининг ${lastOrder?.department?.name} ${lastOrder?.position?.name} вазифасида ишловчи ${employeeFullName} Ўзбекистон Республикаси Меҳнат кодексининг 155, 157-моддасига биноан, тарафларнинг келишувига кўра ${fullDate} кунидан бекор қилинсин.`,
                  size: 28,
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              children: [
                new TextRun({
                  text: `\t- Жамият ҳисобхонасига – ${employeeFullName} ${lastHireDate} кунидан ${fullDate} кунигача ишланган даврда фойдаланилмаган 0 кун меҳнат таътили учун пуллик компенсация ва бошқа тўловларни белгиланган тартибда ҳисоб-китоб қилиш вазифаси топширилсин. (Ўзбекистон Республикаси Меҳнат кодексининг 234-моддаси).`,
                  size: 28,
                }),
              ],
            }),
            new Paragraph({
              spacing: { before: 600 },
              children: [
                new TextRun({
                  text: `«${branchName}»`,
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
    saveAs(blob, `Уволнение ${employeeName}.docx`);
  },
};

export const DownloadLate = {
  employeeMonth: async (modalData, monthDate) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Опоздания");

    // ===== Информация о сотруднике (заголовок) =====
    worksheet.addRow([`${modalData.employeeFullName}`]);
    const titleRow = worksheet.getRow(1);
    titleRow.font = { bold: true, size: 14 };
    titleRow.alignment = { horizontal: "left", vertical: "middle" };

    worksheet.addRow([]);

    // Информация о сотруднике
    worksheet.addRow(["Филиал:", modalData.branchName]);
    worksheet.addRow(["Отдел:", modalData.departmentName]);
    worksheet.addRow(["Должность:", modalData.positionName]);

    // Стилизация информационных строк
    for (let i = 3; i <= 5; i++) {
      const row = worksheet.getRow(i);
      row.getCell(1).font = { bold: true };
    }

    worksheet.addRow([]);

    // ===== Статистика =====
    const statsStartRow = 7;
    worksheet.addRow(["Статистика за месяц"]);
    const statsHeaderRow = worksheet.getRow(statsStartRow);
    statsHeaderRow.font = { bold: true, size: 12 };

    worksheet.addRow([
      "Опоздание на работу (кол-во):",
      modalData.monthlyArrivalLateCount || 0,
    ]);
    worksheet.addRow([
      "Опоздание на работу (время):",
      formatLateMinutesToHours(modalData.monthlyLateMinutes),
    ]);
    worksheet.addRow([
      "Опоздание после перерыва (кол-во):",
      modalData.monthlyLunchLateCount || 0,
    ]);
    worksheet.addRow([
      "Опоздание после перерыва (время):",
      formatLateMinutesToHours(modalData.monthlyBreakReturnLateMinutes),
    ]);
    worksheet.addRow([
      "Сумма за опоздания:",
      modalData.monthlyLateMoney || "0",
    ]);

    // Стилизация статистики
    for (let i = statsStartRow + 1; i <= statsStartRow + 5; i++) {
      const row = worksheet.getRow(i);
      row.getCell(1).font = { bold: true };
    }

    worksheet.addRow([]);

    // ===== Таблица деталей =====
    const tableHeaderRow = statsStartRow + 7;
    const headers = [
      "№",
      "Дата",
      "По графику",
      "Фактический вход",
      "Опоздание на работу (время)",
      "Перерыв до",
      "Вернулся",
      "Опоздание после перерыва (время)",
    ];

    worksheet.addRow(headers);

    const headerRow = worksheet.getRow(tableHeaderRow);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    // Применяем стили ТОЛЬКО к ячейкам с содержимым таблицы
    headers.forEach((header, colIndex) => {
      const cell = headerRow.getCell(colIndex + 1);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F6EF7" }, // Синий цвет
      };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Добавляем данные
    modalData.details?.forEach((item, index) => {
      const row = [
        index + 1,
        item.date,
        item.scheduledStart || "",
        item.actualStart || "",
        item.lateMinutes > 0 ? formatLateMinutesToHours(item.lateMinutes) : "—",
        item.scheduledBreakEnd?.substring(0, 5) || "—",
        item.actualBreakReturn || "—",
        item.breakReturnLateMinutes > 0
          ? formatLateMinutesToHours(item.breakReturnLateMinutes)
          : "—",
      ];

      const newRow = worksheet.addRow(row);

      // Стилизация строк таблицы - применяем только к ячейкам с данными
      row.forEach((value, colIndex) => {
        const cell = newRow.getCell(colIndex + 1);
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      // Подсвечиваем строки с опозданиями без разрешения - только конкретные ячейки
      if (!item.havePermission) {
        row.forEach((value, colIndex) => {
          const cell = newRow.getCell(colIndex + 1);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFF" },
          };
        });
      }
    });

    // ===== Авто-ширина колонок =====
    worksheet.columns.forEach((col, i) => {
      let maxLength = headers[i]?.length || 10;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > maxLength) maxLength = len;
      });
      col.width = Math.min(maxLength + 3, 25); // Макс. ширина 25
    });

    // Закрепляем заголовок таблицы
    worksheet.views = [{ state: "frozen", ySplit: tableHeaderRow }];

    // Сохраняем файл
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Опоздания_${modalData.employeeFullName}_${monthDate}.xlsx`;

    saveAs(new Blob([buffer], { type: "application/octet-stream" }), fileName);
  },
  day: async (data, date) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Опоздание");

    // заголовки
    const headers = [
      "№",
      "ФИО",
      "Филиал",
      "Отдел",
      "Должность",
      "По граффику",
      "Вход",
      "Опоздание (чч:мм)",
    ];

    // добавляем заголовок
    worksheet.addRow(headers);

    // стили для шапки
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // добавляем данные
    data.forEach((item, index) => {
      const row = [
        index + 1,
        item.employeeFullName,
        item.branchName,
        item.departmentName,
        item.positionName,
        item.scheduledStart || "",
        item.actualStart || "",
        formatLateMinutesToHours(item.lateMinutes),
      ];

      const newRow = worksheet.addRow(row);

      // границы и выравнивание
      newRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
    });

    // авто-ширина колонок
    worksheet.columns.forEach((col, i) => {
      let maxLength = headers[i].length;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > maxLength) maxLength = len;
      });
      col.width = maxLength + 2; // немного отступа
    });

    // закрепляем верхнюю строку
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    // создаем excel в браузере
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      `Опоздание за - ${date}.xlsx`,
    );
  },
  monthByEmployee: async (data, date) => {
    if (!Array.isArray(data) || data.length === 0) {
      console.warn("Нет данных для экспорта по филиалам");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Опоздание");

    // заголовки
    const headers = [
      "№",
      "ФИО",
      "Филиал",
      "Отдел",
      "Должность",
      "Опоздание на работу (кол-во)",
      "Опоздание на работу (время)",
      "Опоздание послес перерыва (кол-во)",
      "Опоздание после перерыва (время)",
      "Сумма за опоздания",
    ];

    // добавляем заголовок
    worksheet.addRow(headers);

    // стили для шапки
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // добавляем данные
    data.forEach((item, index) => {
      const row = [
        index + 1,
        item.employeeFullName,
        item.branchName,
        item.departmentName,
        item.positionName,
        item.monthlyArrivalLateCount || 0,
        formatLateMinutesToHours(item.monthlyLateMinutes),
        item.monthlyLunchLateCount || 0,
        formatLateMinutesToHours(item.monthlyBreakReturnLateMinutes),
        item.monthlyLateMoney || "",
      ];

      const newRow = worksheet.addRow(row);

      // границы и выравнивание
      newRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
    });

    // авто-ширина колонок
    worksheet.columns.forEach((col, i) => {
      let maxLength = headers[i].length;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > maxLength) maxLength = len;
      });
      col.width = maxLength + 2; // немного отступа
    });

    // закрепляем верхнюю строку
    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    // создаем excel в браузере
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      `Опоздание за - ${date}.xlsx`,
    );
  },
  monthByBranch: async (data, date) => {
    if (!Array.isArray(data) || data.length === 0) {
      console.warn("Нет данных для экспорта по филиалам");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Опоздание");

    const targetDate = new Date(date);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const allDates = [];
    for (let day = 1; day <= daysInMonth; day++) {
      allDates.push(day.toString());
    }

    // Добавляем колонку Итого
    const headers = ["Филиал", ...allDates, "Итого"];
    worksheet.addRow(headers);

    // ===== Шапка =====
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    let totalByDays = new Array(daysInMonth).fill(0);
    let grandTotal = 0;

    // ===== Данные по филиалам =====
    data.forEach((branch) => {
      const row = [branch.branchName];
      let rowTotal = 0;

      allDates.forEach((dayNumber, index) => {
        const dayData = branch.days.find((d) => {
          const dDate = new Date(d.date);
          return dDate.getDate() === Number(dayNumber);
        });

        const value = dayData ? dayData.lateCount : 0;

        row.push(value);
        rowTotal += value;
        totalByDays[index] += value;
      });

      row.push(rowTotal);
      grandTotal += rowTotal;

      const newRow = worksheet.addRow(row);

      newRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
    });

    // ===== Общий итог =====
    const totalRow = ["Итого", ...totalByDays, grandTotal];
    const finalRow = worksheet.addRow(totalRow);

    finalRow.font = { bold: true };
    finalRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // ===== Авто-ширина =====
    worksheet.columns.forEach((col, i) => {
      let maxLength = headers[i].length;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > maxLength) maxLength = len;
      });
      col.width = maxLength + 2;
    });

    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      `Опоздание за - ${date}.xlsx`,
    );
  },
};
