// Карточка сотрудника в PDF: шапка с фото и KPI, блоки данных и истории.
// Верстается вручную на jsPDF (mm, A4) + autoTable для табличных секций.
import { jsPDF } from "jspdf";
import "jspdf-autotable";

import { robotoRegularBase64, robotoBoldBase64 } from "./robotoFont";
import { getAge } from "./utils";

const PAGE = { w: 210, h: 297, m: 14 };
const W = PAGE.w - PAGE.m * 2;

// Палитра совпадает со светлой темой карточки в интерфейсе
const C = {
  ink: [15, 23, 42],
  sub: [100, 116, 139],
  line: [226, 232, 240],
  soft: [248, 250, 252],
  accent: [37, 99, 235],
  green: [22, 163, 74],
  red: [220, 38, 38],
  white: [255, 255, 255],
};

const ORDER_LABEL_KEYS = {
  hire: "hiredEvent",
  transfer: "transferEvent",
  leave: "leaveEvent",
  terminate: "terminateEvent",
};

const EDUCATION_KEYS = {
  higher: "higherEdu",
  secondary: "secondaryEdu",
  general: "generalEdu",
};

const SALARY_TYPE_KEYS = {
  monthly: "salaryTypeMonthly",
  hourly: "salaryTypeHourly",
  piecework: "salaryTypePiecework",
};

const ASSET_STATE_KEYS = {
  assigned: "stateAssigned",
  returned: "stateReturned",
  scrapped: "stateScrapped",
};

const fmtMoney = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const dash = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

const tenureFrom = (dateStr, t) => {
  if (!dateStr) return "—";
  const from = new Date(dateStr);
  const now = new Date();
  let months =
    (now.getFullYear() - from.getFullYear()) * 12 +
    (now.getMonth() - from.getMonth());
  if (now.getDate() < from.getDate()) months--;
  if (months < 0) return "—";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [
    y > 0 ? `${y} ${t("tenureYearsShort")}` : null,
    `${m} ${t("tenureMonthsShort")}`,
  ]
    .filter(Boolean)
    .join(" ");
};

// Текстовый аналог formatWorkScheduleTime — тот возвращает JSX, в PDF не годится
const scheduleModeText = (schedule, t) => {
  if (!schedule) return "—";
  const dayNames = [
    t("dayMon"),
    t("dayTue"),
    t("dayWed"),
    t("dayThu"),
    t("dayFri"),
    t("daySat"),
    t("daySun"),
  ];

  if (schedule.type === "fixed") {
    const active = (schedule.work_days || []).filter((d) => d.start && d.end);
    if (!active.length) return "—";

    const groups = {};
    active.forEach((d) => {
      const key = `${d.start}-${d.end}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d.day);
    });

    return Object.entries(groups)
      .map(([time, days]) => {
        const [start, end] = time.split("-");
        const sorted = [...days].sort((a, b) => a - b);
        const sequential =
          sorted[sorted.length - 1] - sorted[0] + 1 === sorted.length;
        const label = sequential
          ? `${dayNames[sorted[0] - 1]}–${dayNames[sorted[sorted.length - 1] - 1]}`
          : sorted.map((d) => dayNames[d - 1]).join(", ");
        return `${label}: ${start} – ${end}`;
      })
      .join("\n");
  }

  if (schedule.type === "shift") {
    const shifts = (schedule.shifts || [])
      .filter((s) => s.start && s.end)
      .map(
        (s) => `${s.shift_number} ${t("shift2Label")}: ${s.start} – ${s.end}`,
      );
    return shifts.length ? shifts.join("\n") : "—";
  }

  if (schedule.type === "flexible") return t("flexibleSchedule");

  return "—";
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const roundedPath = (ctx, size, r) => {
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
};

// Аватар для PDF: центральная обрезка в квадрат (иначе портрет растягивается)
// и скруглённые углы поверх подложки шапки — прозрачность в PDF не нужна
const squareAvatar = (img, bgRgb) => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = `rgb(${bgRgb.join(",")})`;
  ctx.fillRect(0, 0, size, size);

  roundedPath(ctx, size, size * 0.11);
  ctx.save();
  ctx.clip();

  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.92);
};

// Фото отдаётся по cookie-сессии — обычный fetch с credentials, не через axios
const fetchPhotoDataUrl = async (url, bgRgb) => {
  if (!url) return null;
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const raw = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!raw) return null;

    try {
      return squareAvatar(await loadImage(raw), bgRgb);
    } catch {
      // canvas недоступен — кладём исходник как есть
      return raw;
    }
  } catch {
    return null;
  }
};

export const downloadEmployeeProfilePdf = async ({
  profile,
  efficiency = null,
  t,
  hideBranch = false,
  photoUrl = null,
}) => {
  if (!profile?.employee) return;

  const emp = profile.employee;
  const doc = new jsPDF({ format: "a4", unit: "mm" });

  doc.addFileToVFS("Roboto-Regular.ttf", robotoRegularBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", robotoBoldBase64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  doc.setFont("Roboto", "normal");

  const fullName =
    [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(" ") ||
    `#${emp.id}`;

  // Дата найма — самый ранний приказ о приёме, иначе дата заведения карточки
  const hireDate = (() => {
    const hires = profile.employmentOrders.filter(
      (o) => o.type === "hire" && o.date,
    );
    if (hires.length) {
      return hires.reduce(
        (min, o) => (new Date(o.date) < new Date(min) ? o.date : min),
        hires[0].date,
      );
    }
    return emp.added_at || null;
  })();

  // Фон шапки светлый — аватар подкладывается тем же цветом, чтобы скруглённые
  // углы не выделялись серым квадратом
  const photo = await fetchPhotoDataUrl(photoUrl, C.white);

  // ── Шапка ────────────────────────────────────────────────────────────────
  // Белая карточка с серой полосой-подвалом: сверху фото и имя, снизу контакты
  const headTop = 12;
  const headH = 42;
  const bandH = 11;
  const bandY = headTop + headH - bandH;

  doc.setFillColor(...C.white);
  doc.roundedRect(PAGE.m, headTop, W, headH, 3.5, 3.5, "F");

  doc.setFillColor(...C.soft);
  doc.roundedRect(PAGE.m, bandY, W, bandH, 3.5, 3.5, "F");
  // верхние углы подвала должны остаться прямыми
  doc.rect(PAGE.m, bandY, W, 4, "F");

  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.2);
  doc.line(PAGE.m, bandY, PAGE.m + W, bandY);
  doc.setLineWidth(0.25);
  doc.roundedRect(PAGE.m, headTop, W, headH, 3.5, 3.5, "S");

  const avatarS = 23;
  const avatarX = PAGE.m + 7;
  const avatarY = headTop + (headH - bandH - avatarS) / 2;

  // мягкая тень: тонкая подложка со сдвигом, без резкой рамки
  doc.setFillColor(232, 237, 243);
  doc.roundedRect(avatarX + 0.7, avatarY + 0.9, avatarS, avatarS, 2.6, 2.6, "F");

  if (photo) {
    try {
      // формат берём из самого data URL: без канваса сюда попадёт оригинал
      const format = photo.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(photo, format, avatarX, avatarY, avatarS, avatarS, "", "FAST");
    } catch {
      // битое фото — карточка просто без аватара
    }
  } else {
    doc.setFillColor(...C.soft);
    doc.roundedRect(avatarX, avatarY, avatarS, avatarS, 2.6, 2.6, "F");
    const initials = [emp.last_name, emp.first_name]
      .filter(Boolean)
      .map((n) => n[0]?.toUpperCase())
      .join("");
    doc.setFont("Roboto", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...C.sub);
    doc.text(initials || "—", avatarX + avatarS / 2, avatarY + avatarS / 2 + 2, {
      align: "center",
    });
  }

  const infoX = avatarX + avatarS + 8;

  // надзаголовок документа
  doc.setFont("Roboto", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text(t("employeeCardDoc").toUpperCase(), infoX, headTop + 9, {
    charSpace: 0.5,
  });

  doc.setFont("Roboto", "bold");
  doc.setFontSize(15.5);
  doc.setTextColor(...C.ink);
  doc.text(doc.splitTextToSize(fullName, 108)[0], infoX, headTop + 17.5);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  const subtitle =
    [
      emp.position?.name,
      emp.department?.name,
      hideBranch ? null : emp.branch?.name,
    ]
      .filter(Boolean)
      .join("  ·  ") || "—";
  doc.text(doc.splitTextToSize(subtitle, 108)[0], infoX, headTop + 24.5);

  // Статус: мягкая заливка вместо кричащей — на светлом листе спокойнее
  const isActive = emp.status !== false;
  const statusText = isActive ? t("active") : t("terminated");
  doc.setFont("Roboto", "bold");
  doc.setFontSize(8);
  const chipW = doc.getTextWidth(statusText) + 9;
  const chipX = PAGE.m + W - 7 - chipW;
  doc.setFillColor(...(isActive ? [220, 252, 231] : [254, 226, 226]));
  doc.roundedRect(chipX, headTop + 7, chipW, 6.8, 3.4, 3.4, "F");
  doc.setTextColor(...(isActive ? [21, 128, 61] : [185, 28, 28]));
  doc.text(statusText, chipX + chipW / 2, headTop + 11.6, { align: "center" });

  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`ID ${emp.id}`, PAGE.m + W - 7, headTop + 19.5, { align: "right" });

  // Контакты в подвале — белыми пилюлями по серой полосе
  const stamp = `${t("generatedAt")}: ${fmtDateTime(new Date())}`;
  doc.setFontSize(7.2);
  const stampW = doc.getTextWidth(stamp);

  const pills = [
    emp.phone,
    emp.email,
    emp.date_of_birth
      ? `${fmtDate(emp.date_of_birth)} · ${getAge(emp.date_of_birth)} ${t("yearsOld")}`
      : null,
    emp.employee_number ? `${t("employeeNumber")}: ${emp.employee_number}` : null,
  ].filter(Boolean);

  const pillH = 6;
  const pillY = bandY + (bandH - pillH) / 2;
  const pillLimit = PAGE.m + W - stampW - 12;
  let pillX = PAGE.m + 6;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.4);
  pills.forEach((text) => {
    const w = doc.getTextWidth(text) + 7;
    if (pillX + w > pillLimit) return;

    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.roundedRect(pillX, pillY, w, pillH, 3, 3, "FD");
    doc.setTextColor(...C.sub);
    doc.text(text, pillX + w / 2, pillY + pillH / 2 + 1.2, { align: "center" });
    pillX += w + 3;
  });

  doc.setFontSize(7.2);
  doc.setTextColor(148, 163, 184);
  doc.text(stamp, PAGE.m + W - 6, pillY + pillH / 2 + 1.2, { align: "right" });

  // ── KPI-полоса ───────────────────────────────────────────────────────────
  const kpis = [
    {
      label: t("efficiency"),
      value: efficiency?.hasData ? String(Math.round(efficiency.score)) : "—",
      sub: efficiency?.hasData
        ? t(`effGrade_${efficiency.grade}`)
        : t("effNoData"),
    },
    { label: t("tenure"), value: tenureFrom(hireDate, t), sub: fmtDate(hireDate) },
    {
      label: t("currentSalary"),
      value: profile.summary.currentSalary
        ? fmtMoney(profile.summary.currentSalary.amount)
        : "—",
      sub: profile.summary.currentSalary
        ? t(
            SALARY_TYPE_KEYS[profile.summary.currentSalary.salary_type] ||
              profile.summary.currentSalary.salary_type,
          )
        : t("noSalarySet"),
    },
    {
      label: t("workSchedule"),
      value: emp.workSchedule?.name || "—",
      sub: emp.workSchedule
        ? t(`scheduleType.${emp.workSchedule.type}`)
        : t("noData"),
    },
    {
      label: t("assetsOnHand"),
      value: String(profile.summary.assets.assigned),
      sub: `${t("assetsReturnedShort")}: ${profile.summary.assets.returned}`,
    },
    {
      label: t("salaryBalance"),
      value: fmtMoney(profile.summary.totals.balance),
      sub: `${t("paid")}: ${fmtMoney(profile.summary.totals.paid)}`,
    },
  ];

  const kpiGap = 4;
  const kpiW = (W - kpiGap * 2) / 3;
  const kpiH = 17;
  const kpiTop = headTop + headH + 5;

  kpis.forEach((k, i) => {
    const x = PAGE.m + (i % 3) * (kpiW + kpiGap);
    const y = kpiTop + Math.floor(i / 3) * (kpiH + kpiGap);

    doc.setFillColor(...C.soft);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, kpiW, kpiH, 2.5, 2.5, "FD");

    doc.setFont("Roboto", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.sub);
    doc.text(doc.splitTextToSize(k.label.toUpperCase(), kpiW - 6)[0], x + 3.5, y + 5);

    doc.setFont("Roboto", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.ink);
    doc.text(doc.splitTextToSize(k.value, kpiW - 6)[0], x + 3.5, y + 11);

    doc.setFont("Roboto", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.sub);
    doc.text(doc.splitTextToSize(k.sub || "", kpiW - 6)[0], x + 3.5, y + 15);
  });

  // ── Блоки «ключ — значение» в две колонки ────────────────────────────────
  const infoTable = (title, rows, x, startY, width) => {
    doc.autoTable({
      startY,
      margin: { left: x, right: PAGE.w - x - width, bottom: 18 },
      tableWidth: width,
      theme: "grid",
      head: [[{ content: title, colSpan: 2 }]],
      headStyles: {
        font: "Roboto",
        fontStyle: "bold",
        fontSize: 8.5,
        fillColor: [235, 240, 246],
        textColor: C.ink,
        lineColor: C.line,
        lineWidth: 0.15,
        cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
      },
      styles: {
        font: "Roboto",
        fontSize: 8.2,
        textColor: C.ink,
        lineColor: C.line,
        lineWidth: 0.15,
        cellPadding: { top: 1.9, bottom: 1.9, left: 3, right: 3 },
        overflow: "linebreak",
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: width * 0.42, textColor: C.sub },
        1: { cellWidth: "auto", fontStyle: "bold" },
      },
      body: rows.map(([label, value]) => [label, dash(value)]),
    });
    return doc.lastAutoTable.finalY;
  };

  const colW = (W - 6) / 2;
  const colLeftX = PAGE.m;
  const colRightX = PAGE.m + colW + 6;
  let yLeft = kpiTop + kpiH * 2 + kpiGap + 6;
  let yRight = yLeft;

  yLeft = infoTable(
    t("personalData"),
    [
      [t("fullName"), fullName],
      [
        t("dateOfBirth"),
        emp.date_of_birth
          ? `${fmtDate(emp.date_of_birth)} (${getAge(emp.date_of_birth)} ${t("yearsOld")})`
          : null,
      ],
      [
        t("gender"),
        emp.gender === "male"
          ? t("male")
          : emp.gender === "female"
            ? t("female")
            : t("notSpecified"),
      ],
      [
        t("education"),
        emp.education ? t(EDUCATION_KEYS[emp.education] || emp.education) : null,
      ],
      [t("speciality"), emp.education_specialty],
    ],
    colLeftX,
    yLeft,
    colW,
  );

  yRight = infoTable(
    t("jobTitle"),
    [
      ...(hideBranch ? [] : [[t("branch"), emp.branch?.name]]),
      [t("department"), emp.department?.name],
      [t("position"), emp.position?.name],
      [t("hireDate"), fmtDate(hireDate)],
      [t("tenure"), tenureFrom(hireDate, t)],
      [t("workSchedule"), emp.workSchedule?.name],
      [t("workMode"), scheduleModeText(emp.workSchedule, t)],
    ],
    colRightX,
    yRight,
    colW,
  );

  yLeft = infoTable(
    t("contactsTitle"),
    [
      [t("phone"), emp.phone],
      [t("email"), emp.email],
      [t("address"), emp.address],
    ],
    colLeftX,
    yLeft + 5,
    colW,
  );

  yRight = infoTable(
    t("accessTitle"),
    [
      [t("username"), emp.user?.username],
      [
        t("accessLevelLabel"),
        emp.user?.access_level ? t(`access_${emp.user.access_level}`) : null,
      ],
      [t("telegramId"), emp.user?.telegram_id],
      [
        t("doors"),
        emp.doors?.length ? emp.doors.map((d) => d.name).join(", ") : null,
      ],
    ],
    colRightX,
    yRight + 5,
    colW,
  );

  yLeft = infoTable(
    t("documentsTitle"),
    [
      [t("pinfl"), emp.pinfl],
      [t("passport"), emp.passport],
      [
        t("passportExpiry"),
        emp.passport_expiry_date ? fmtDate(emp.passport_expiry_date) : null,
      ],
      [t("employeeNumber"), emp.employee_number],
    ],
    colLeftX,
    yLeft + 5,
    colW,
  );

  yRight = infoTable(
    t("attendance"),
    [
      [t("totalFacePassesLabel"), profile.attendance.totalPasses],
      [
        t("firstPassLabel"),
        profile.attendance.firstPassAt
          ? fmtDateTime(profile.attendance.firstPassAt)
          : null,
      ],
      [
        t("lastPassLabel"),
        profile.attendance.lastPassAt
          ? fmtDateTime(profile.attendance.lastPassAt)
          : null,
      ],
      [
        t("passDirection"),
        profile.attendance.lastPassDirection
          ? profile.attendance.lastPassDirection === "in"
            ? t("entry")
            : t("exit")
          : null,
      ],
      [t("door"), profile.attendance.lastPassDoor],
    ],
    colRightX,
    yRight + 5,
    colW,
  );

  // ── Секции с историями ───────────────────────────────────────────────────
  let y = Math.max(yLeft, yRight) + 9;

  const sectionTitle = (title, count) => {
    // заголовок не должен остаться внизу страницы без своей таблицы
    if (y > PAGE.h - 45) {
      doc.addPage();
      y = PAGE.m + 4;
    }
    doc.setFillColor(...C.soft);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.roundedRect(PAGE.m, y, W, 8, 2, 2, "FD");

    doc.setFont("Roboto", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.ink);
    doc.text(title, PAGE.m + 4, y + 5.4);

    if (count !== undefined) {
      doc.setFont("Roboto", "normal");
      doc.setTextColor(...C.sub);
      doc.text(String(count), PAGE.m + W - 4, y + 5.4, { align: "right" });
    }

    y += 8;
  };

  const historyTable = (head, body, columnStyles = {}) => {
    doc.autoTable({
      startY: y,
      margin: { left: PAGE.m, right: PAGE.m, bottom: 18 },
      tableWidth: W,
      theme: "striped",
      head: [head],
      headStyles: {
        font: "Roboto",
        fontStyle: "bold",
        fontSize: 8,
        fillColor: [241, 245, 249],
        textColor: C.ink,
        lineColor: C.line,
        lineWidth: 0.15,
        cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
      },
      styles: {
        font: "Roboto",
        fontSize: 8,
        textColor: C.ink,
        lineColor: C.line,
        lineWidth: 0.15,
        cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 },
        overflow: "linebreak",
        valign: "middle",
      },
      alternateRowStyles: { fillColor: [252, 252, 253] },
      columnStyles,
      body,
    });
    y = doc.lastAutoTable.finalY + 7;
  };

  const period = (from, to) =>
    `${fmtDate(from)} — ${to ? fmtDate(to) : t("presentToDate")}`;

  if (profile.employmentOrders.length) {
    sectionTitle(t("employmentOrdersHistory"), profile.employmentOrders.length);
    historyTable(
      [
        t("date"),
        t("type"),
        t("orderNumber"),
        ...(hideBranch ? [] : [t("branch")]),
        t("department"),
        t("position"),
        t("note"),
      ],
      profile.employmentOrders.map((o) => [
        fmtDate(o.date),
        ORDER_LABEL_KEYS[o.type] ? t(ORDER_LABEL_KEYS[o.type]) : dash(o.type),
        dash(o.order_number),
        ...(hideBranch ? [] : [dash(o.branch?.name)]),
        dash(o.department?.name),
        dash(o.position?.name),
        dash(o.note),
      ]),
      { 0: { cellWidth: 20 }, 2: { cellWidth: 18 } },
    );
  }

  if (profile.timeOff.length) {
    sectionTitle(t("timeOffHistory"), profile.timeOff.length);
    historyTable(
      [t("period"), t("type"), t("reason"), t("paidTimeOff"), t("addedBy")],
      profile.timeOff.map((to) => [
        to.type === "hour"
          ? `${fmtDateTime(to.date_from)} — ${fmtDateTime(to.date_to)}`
          : `${fmtDate(to.date_from)} — ${fmtDate(to.date_to)}`,
        t(to.type),
        dash(to.reason),
        to.is_company_paid ? t("yes") : t("no"),
        dash(to.addedBy),
      ]),
      { 0: { cellWidth: 52 }, 3: { cellWidth: 20 } },
    );
  }

  if (profile.scheduleHistory.length) {
    sectionTitle(t("scheduleHistory"), profile.scheduleHistory.length);
    historyTable(
      [t("period"), t("workSchedule"), t("type"), t("workMode"), t("addedBy")],
      profile.scheduleHistory.map((s) => [
        period(s.date_from, s.date_to),
        dash(s.workSchedule?.name),
        s.workSchedule?.type ? t(`scheduleType.${s.workSchedule.type}`) : "—",
        scheduleModeText(s.workSchedule, t),
        dash(s.addedBy),
      ]),
      { 0: { cellWidth: 40 } },
    );
  }

  if (profile.salaryHistory.length) {
    sectionTitle(t("salaryHistory"), profile.salaryHistory.length);
    historyTable(
      [t("period"), t("amount"), t("type"), t("note"), t("addedBy")],
      profile.salaryHistory.map((s, i) => {
        const prev = profile.salaryHistory[i + 1];
        const diff = prev ? s.amount - prev.amount : 0;
        return [
          period(s.date_from, s.date_to),
          `${fmtMoney(s.amount)}${
            diff !== 0
              ? ` (${diff > 0 ? "+" : "−"}${fmtMoney(Math.abs(diff))})`
              : ""
          }`,
          t(SALARY_TYPE_KEYS[s.salary_type] || s.salary_type),
          dash(s.note),
          dash(s.addedBy),
        ];
      }),
      { 0: { cellWidth: 40 }, 1: { cellWidth: 42, fontStyle: "bold" } },
    );
  }

  if (profile.payrollItems.length) {
    sectionTitle(t("financeHistory"), profile.payrollItems.length);
    historyTable(
      [t("month"), t("accrued"), t("paid"), t("salaryBalance"), t("status")],
      profile.payrollItems.map((p) => [
        `${String(p.month || "").padStart(2, "0")}.${p.year || ""}`,
        fmtMoney(p.net),
        fmtMoney(p.paid_amount),
        fmtMoney(
          Math.max(
            0,
            Number(p.net || 0) -
              Number(p.debt_deduction || 0) -
              Number(p.paid_amount || 0),
          ),
        ),
        // месяц без начислений и выплат: «Не оплачено» тут вводит в заблуждение
        p.accrued === 0 && p.net === 0 && p.paid_amount === 0
          ? t("payoutStatus.nothing")
          : t(`payoutStatus.${p.payout_status}`, p.payout_status),
      ]),
      {
        0: { cellWidth: 24 },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
    );
  }

  if (profile.assetAssignments.length) {
    sectionTitle(t("assetsHistory"), profile.assetAssignments.length);
    historyTable(
      [
        t("assetName"),
        t("quantity"),
        t("status"),
        t("assignedDate"),
        t("returnDate"),
        t("addedBy"),
      ],
      profile.assetAssignments.map((a) => [
        [a.asset_name, a.asset_spec].filter(Boolean).join(" — "),
        String(a.quantity ?? 1),
        t(ASSET_STATE_KEYS[a.state] || a.state),
        fmtDate(a.assigned_date),
        a.return_date ? fmtDate(a.return_date) : "—",
        dash(a.addedBy),
      ]),
      {
        1: { cellWidth: 16, halign: "center" },
        2: { cellWidth: 24 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
      },
    );
  }

  // ── Колонтитулы ──────────────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.line);
    doc.setLineWidth(0.2);
    doc.line(PAGE.m, PAGE.h - 12, PAGE.m + W, PAGE.h - 12);

    doc.setFont("Roboto", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.sub);
    doc.text(`${fullName} · ID ${emp.id}`, PAGE.m, PAGE.h - 8);
    doc.text(`${i} / ${pages}`, PAGE.m + W, PAGE.h - 8, { align: "right" });
  }

  const safeName =
    fullName.replace(/[\\/:*?"<>|]/g, "").trim() || `employee-${emp.id}`;
  doc.save(`${safeName} #${emp.id}.pdf`);
};
