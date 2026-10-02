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
import api from "../api/instance";

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

// ===== Фото сотрудников в Excel =====
const PHOTO_RENDER_SIZE = 128; // px — рендерим в 2х для чёткости
// Ширина колонки в символах → px, как считает сам Excel (MDW = 7px для Calibri 11).
// Наивное width*7+5 даёт на 5px больше реальности — фото вылезало за рамку
const MAX_DIGIT_WIDTH = 7;
const colWidthToPx = (width) =>
  Math.trunc(
    ((256 * width + Math.trunc(128 / MAX_DIGIT_WIDTH)) / 256) * MAX_DIGIT_WIDTH,
  );
const rowHeightToPx = (height) => Math.trunc((height * 96) / 72);

// Ширину ровно 9 ExcelJS считает дефолтной и <col> не пишет — колонка уезжает
// на дефолтную ширину Excel. Сдвигаем на сотую
const safeColWidth = (width) => (width === 9 ? 9.01 : width);

// Ровно 9 нельзя: у ExcelJS DEFAULT_COLUMN_WIDTH = 9, и при таком значении
// isCustomWidth = false — <col> в файл не пишется, Excel берёт свою дефолтную
// ширину (шире) и ячейка перестаёт быть квадратной
const PHOTO_COL_WIDTH = 9.5; // символы → 66px
const PHOTO_ROW_HEIGHT = 49.5; // pt → 66px, ячейка квадратная

const PHOTO_CELL_WIDTH_PX = colWidthToPx(PHOTO_COL_WIDTH);
const PHOTO_CELL_HEIGHT_PX = rowHeightToPx(PHOTO_ROW_HEIGHT);

// Размер квадрата берём от ВЫСОТЫ строки: она задана в пунктах и считается
// одинаково везде. Ширина колонки в px зависит от шрифта Normal у конкретного
// Excel, поэтому опираться на неё нельзя — но она всегда не меньше высоты
// строки, значит по горизонтали фото тоже помещается.
// 0.8 — запас на просмотрщики, которые масштабируют картинку не как строку
const PHOTO_DISPLAY_SIZE = Math.round(PHOTO_CELL_HEIGHT_PX * 0.8);

// Кадрируем плотнее: на снимках с турникета человек мелкий, сверху потолок
const PHOTO_ZOOM = 1.3;
// Доля вертикального запаса, отрезаемая сверху (0 — верх кадра, 1 — низ)
const PHOTO_VERTICAL_BIAS = 0.4;

async function decodeImage(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      // старые браузеры / неподдерживаемый формат — идём через <img>
    }
  }

  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать фото"));
    };
    img.src = url;
  });
}

// Квадратный кроп «cover»: лишнее по длинной стороне обрезаем, пропорции лица
// не трогаем. По горизонтали — центр, по вертикали кадр смещён вниз, к лицу
async function makeAvatarPng(blob) {
  const img = await decodeImage(blob);
  const width = img.width;
  const height = img.height;
  if (!width || !height) throw new Error("Пустое фото");

  const side = Math.min(width, height) / PHOTO_ZOOM;
  const sx = (width - side) / 2;
  const sy = (height - side) * PHOTO_VERTICAL_BIAS;

  const size = PHOTO_RENDER_SIZE;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  img.close?.();

  const png = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!png) throw new Error("Не удалось собрать аватар");

  return { buffer: new Uint8Array(await png.arrayBuffer()), extension: "png" };
}

// Аватар: фото из анкеты, иначе снимок с последнего опоздания (face pass)
function resolvePhotoPath(item) {
  if (item?.employeePhoto) return `/employees/image/${item.employeePhoto}`;

  const latePhoto = item?.actualStartPhoto || item?.lastLatePhoto;
  return latePhoto ? `/face-passes/image/${latePhoto}` : null;
}

// Грузим фото параллельно, без дублей. Недоступное фото — инициалы в ячейке
async function fetchEmployeePhotos(items) {
  const paths = [
    ...new Set((items || []).map(resolvePhotoPath).filter(Boolean)),
  ];

  const entries = await Promise.all(
    paths.map(async (path) => {
      try {
        const res = await api.get(path, { responseType: "blob" });
        return [path, await makeAvatarPng(res.data)];
      } catch {
        return null;
      }
    }),
  );

  return new Map(entries.filter(Boolean));
}

function getInitials(fullName = "") {
  return fullName
    .replace(/\s+\(?\d+\)?$/, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// Один imageId на фото; аватар на всю ячейку, рамки ячейки остаются видимыми
function createPhotoInserter(workbook, worksheet, photos, colNumber) {
  const ids = new Map();

  // Якорь по одному углу + явный квадратный размер: Excel рисует ровно ext и
  // ничего не растягивает (при tl+br картинку вписывает в ячейку — а она не
  // квадратная, если шрифт Normal шире Calibri 11, отсюда и было растяжение)
  const colOffset =
    (PHOTO_CELL_WIDTH_PX - PHOTO_DISPLAY_SIZE) / 2 / PHOTO_CELL_WIDTH_PX;
  const rowOffset =
    (PHOTO_CELL_HEIGHT_PX - PHOTO_DISPLAY_SIZE) / 2 / PHOTO_CELL_HEIGHT_PX;

  return (item, rowNumber) => {
    const photoPath = resolvePhotoPath(item);
    const photo = photoPath ? photos.get(photoPath) : null;

    if (!photo) {
      // без фото — инициалы, чтобы колонка не выглядела пустой
      const cell = worksheet.getRow(rowNumber).getCell(colNumber);
      cell.value = getInitials(item?.employeeFullName);
      cell.font = { bold: true, size: 12, color: { argb: "FF64748B" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      return;
    }

    if (!ids.has(photoPath)) ids.set(photoPath, workbook.addImage(photo));

    worksheet.addImage(ids.get(photoPath), {
      tl: { col: colNumber - 1 + colOffset, row: rowNumber - 1 + rowOffset },
      ext: { width: PHOTO_DISPLAY_SIZE, height: PHOTO_DISPLAY_SIZE },
      editAs: "oneCell",
    });
  };
}

const THIN_BORDER = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
};

// "2026-08-01" → "01.08.2026". Строку режем вручную: new Date() для "YYYY-MM-DD"
// парсит как UTC и в UTC+5 сдвигать не надо, но в других TZ даст предыдущий день
function formatDayRu(isoDay) {
  const [y, m, d] = String(isoDay).split("-");
  return d ? `${d}.${m}.${y}` : String(isoDay);
}

// Заголовок «за какой период» — добавляется только в режиме «за период»
function addPeriodTitleRow(worksheet, colCount, dateFrom, dateTo) {
  const row = worksheet.addRow([
    `Период: ${formatDayRu(dateFrom)} — ${formatDayRu(dateTo)}`,
  ]);
  worksheet.mergeCells(row.number, 1, row.number, colCount);
  row.font = { bold: true, size: 12 };
  row.alignment = { horizontal: "left", vertical: "middle" };
  return row.number;
}

function styleRowCells(row, colCount, font) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    if (font) cell.font = font;
  }
}

// Группировка как в выгрузке посещаемости (buildEmployeesByBranchSheet):
// филиалы по sort_order → названию, внутри — должность, отдел, ФИО
function groupLateByBranch(items, { branchSortMap, positionSortMap } = {}) {
  const branches = new Map();

  items.forEach((item) => {
    const name = item.branchName || "—";
    if (!branches.has(name)) {
      branches.set(name, {
        name,
        sortOrder: branchSortMap?.get(name) ?? 0,
        employees: [],
      });
    }
    branches.get(name).employees.push(item);
  });

  const byPositionThenName = (a, b) =>
    (positionSortMap?.get(a.positionName) ?? 0) -
      (positionSortMap?.get(b.positionName) ?? 0) ||
    (a.departmentName || "").localeCompare(b.departmentName || "", "ru", {
      sensitivity: "base",
    }) ||
    (a.employeeFullName || "").localeCompare(b.employeeFullName || "", "ru", {
      sensitivity: "base",
    });

  return [...branches.values()]
    .map((branch) => ({
      ...branch,
      employees: [...branch.employees].sort(byPositionThenName),
    }))
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name, "ru", { sensitivity: "base" }),
    );
}

export const DownloadLate = {
  employeeMonth: async (modalData, monthDate, includeLunch = false) => {
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

    // Строки про перерыв — только если в фильтре включено «после обеда»
    const statsRows = [
      ["Рабочих дней по графику:", modalData.monthlyWorkDays || 0],
      ["Отработано дней:", modalData.monthlyAttendedDays || 0],
      [
        "Кол-во опозданий:",
        modalData.monthlyArrivalLateCount || 0,
      ],
      [
        "Время опоздания (чч:мм):",
        formatLateMinutesToHours(modalData.monthlyLateMinutes),
      ],
      ...(includeLunch
        ? [
            [
              "Кол-во опозданий после перерыва:",
              modalData.monthlyLunchLateCount || 0,
            ],
            [
              "Время опоздания после перерыва (чч:мм):",
              formatLateMinutesToHours(modalData.monthlyBreakReturnLateMinutes),
            ],
          ]
        : []),
      ["Общая сумма штрафа:", modalData.monthlyLateMoney || "0"],
    ];

    statsRows.forEach((row) => worksheet.addRow(row));

    // Стилизация статистики
    for (let i = statsStartRow + 1; i <= statsStartRow + statsRows.length; i++) {
      const row = worksheet.getRow(i);
      row.getCell(1).font = { bold: true };
    }

    worksheet.addRow([]);

    // ===== Таблица деталей =====
    const tableHeaderRow = statsStartRow + statsRows.length + 2;
    const headers = [
      "№",
      "Дата",
      "По графику",
      "Фактический вход",
      "Время опоздания (чч:мм)",
      ...(includeLunch
        ? ["Перерыв до", "Вернулся", "Время опоздания после перерыва (чч:мм)"]
        : []),
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
        ...(includeLunch
          ? [
              item.scheduledBreakEnd?.substring(0, 5) || "—",
              item.actualBreakReturn || "—",
              item.breakReturnLateMinutes > 0
                ? formatLateMinutesToHours(item.breakReturnLateMinutes)
                : "—",
            ]
          : []),
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
      col.width = safeColWidth(Math.min(maxLength + 3, 25)); // Макс. ширина 25
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

    const photos = await fetchEmployeePhotos(data);
    const PHOTO_COL = 2;
    const insertPhoto = createPhotoInserter(
      workbook,
      worksheet,
      photos,
      PHOTO_COL,
    );

    // заголовки
    const headers = [
      "№",
      "Фото",
      "ФИО",
      "Филиал",
      "Отдел",
      "Должность",
      "По граффику",
      "Вход",
      "Время опоздания (чч:мм)",
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
        "",
        item.employeeFullName,
        item.branchName,
        item.departmentName,
        item.positionName,
        item.scheduledStart || "",
        item.actualStart || "",
        formatLateMinutesToHours(item.lateMinutes),
      ];

      const newRow = worksheet.addRow(row);
      newRow.height = PHOTO_ROW_HEIGHT;

      // границы и выравнивание
      for (let c = 1; c <= headers.length; c++) {
        const cell = newRow.getCell(c);
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }

      insertPhoto(item, newRow.number);
    });

    // авто-ширина колонок
    worksheet.columns.forEach((col, i) => {
      if (i === PHOTO_COL - 1) {
        col.width = PHOTO_COL_WIDTH;
        return;
      }
      let maxLength = headers[i].length;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > maxLength) maxLength = len;
      });
      col.width = safeColWidth(maxLength + 2); // немного отступа
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
  // sortMaps = { branchSortMap, positionSortMap } — sort_order из справочников,
  // чтобы порядок филиалов и должностей совпадал с выгрузкой посещаемости
  // dateTo задан только в режиме «за период»
  monthByEmployee: async (
    data,
    date,
    includeLunch = false,
    sortMaps = {},
    dateTo = null,
  ) => {
    if (!Array.isArray(data) || data.length === 0) {
      console.warn("Нет данных для экспорта по сотрудникам");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Опоздание");

    const photos = await fetchEmployeePhotos(data);
    const PHOTO_COL = 2;
    const insertPhoto = createPhotoInserter(
      workbook,
      worksheet,
      photos,
      PHOTO_COL,
    );

    // «Филиал» отдельной колонкой не нужен — он в строке-заголовке группы
    const headers = [
      "№",
      "Фото",
      "ФИО",
      "Отдел",
      "Должность",
      "Рабочих дней",
      "Отработано дней",
      "Кол-во опозданий",
      "Время опоздания (чч:мм)",
      ...(includeLunch
        ? [
            "Кол-во опозданий после перерыва",
            "Время опоздания после перерыва (чч:мм)",
          ]
        : []),
      "Общая сумма штрафа",
    ];

    // строки-заголовки филиалов пропускаем при расчёте ширины: объединённая
    // ячейка иначе растянет первую колонку по длине названия
    const branchHeaderRows = new Set();

    if (dateTo) {
      branchHeaderRows.add(
        addPeriodTitleRow(worksheet, headers.length, date, dateTo),
      );
      worksheet.addRow([]);
    }

    groupLateByBranch(data, sortMaps).forEach((branch) => {
      const branchRow = worksheet.addRow([branch.name]);
      branchHeaderRows.add(branchRow.number);
      worksheet.mergeCells(
        branchRow.number,
        1,
        branchRow.number,
        headers.length,
      );
      styleRowCells(branchRow, headers.length, { bold: true, size: 12 });

      const headerRow = worksheet.addRow(headers);
      styleRowCells(headerRow, headers.length, { bold: true });

      branch.employees.forEach((item, index) => {
        const row = [
          index + 1,
          "",
          item.employeeFullName,
          item.departmentName,
          item.positionName,
          item.monthlyWorkDays || 0,
          item.monthlyAttendedDays || 0,
          item.monthlyArrivalLateCount || 0,
          formatLateMinutesToHours(item.monthlyLateMinutes),
          ...(includeLunch
            ? [
                item.monthlyLunchLateCount || 0,
                formatLateMinutesToHours(item.monthlyBreakReturnLateMinutes),
              ]
            : []),
          item.monthlyLateMoney || "",
        ];

        const newRow = worksheet.addRow(row);
        newRow.height = PHOTO_ROW_HEIGHT;
        styleRowCells(newRow, headers.length);

        insertPhoto(item, newRow.number);
      });
    });

    // авто-ширина колонок
    const colWidths = headers.map((h) => h.length);
    worksheet.eachRow((row, rowNumber) => {
      if (branchHeaderRows.has(rowNumber)) return;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > (colWidths[colNumber - 1] ?? 0))
          colWidths[colNumber - 1] = len;
      });
    });
    worksheet.columns.forEach((col, i) => {
      col.width =
        i === PHOTO_COL - 1
          ? PHOTO_COL_WIDTH
          : safeColWidth((colWidths[i] ?? 10) + 2);
    });

    // создаем excel в браузере
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      `Опоздание за - ${date}${dateTo ? ` — ${dateTo}` : ""}.xlsx`,
    );
  },
  // dateTo задан только в режиме «за период»: тогда колонки строим по диапазону
  monthByBranch: async (data, date, dateTo = null) => {
    if (!Array.isArray(data) || data.length === 0) {
      console.warn("Нет данных для экспорта по филиалам");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Опоздание");

    // allDays — ключи "YYYY-MM-DD", allDates — подписи колонок
    const allDays = [];
    if (dateTo) {
      const cursor = new Date(`${date}T00:00:00`);
      const last = new Date(`${dateTo}T00:00:00`);
      while (cursor <= last) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, "0");
        const d = String(cursor.getDate()).padStart(2, "0");
        allDays.push(`${y}-${m}-${d}`);
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      const targetDate = new Date(date);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        allDays.push(
          `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        );
      }
    }

    const multiMonth = new Set(allDays.map((d) => d.slice(0, 7))).size > 1;
    const allDates = allDays.map((d) => {
      const [, mm, dd] = d.split("-");
      return multiMonth ? `${dd}.${mm}` : String(Number(dd));
    });

    // Добавляем колонку Итого
    const headers = ["Филиал", ...allDates, "Итого"];

    const titleRowNumber = dateTo
      ? addPeriodTitleRow(worksheet, headers.length, date, dateTo)
      : null;

    // ===== Шапка =====
    const headerRow = worksheet.addRow(headers);
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

    let totalByDays = new Array(allDays.length).fill(0);
    let grandTotal = 0;

    // ===== Данные по филиалам =====
    data.forEach((branch) => {
      const row = [branch.branchName];
      let rowTotal = 0;

      allDays.forEach((dayKey, index) => {
        const dayData = branch.days.find((d) => d.date === dayKey);

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
    // строку с периодом пропускаем: объединённая ячейка растянула бы колонку «Филиал»
    worksheet.columns.forEach((col, i) => {
      let maxLength = headers[i].length;
      col.eachCell({ includeEmpty: true }, (cell) => {
        if (titleRowNumber && cell.row === titleRowNumber) return;
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > maxLength) maxLength = len;
      });
      col.width = safeColWidth(maxLength + 2);
    });

    worksheet.views = [
      { state: "frozen", ySplit: titleRowNumber ? titleRowNumber + 1 : 1 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      `Опоздание за - ${date}${dateTo ? ` — ${dateTo}` : ""}.xlsx`,
    );
  },
};
