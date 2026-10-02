// Хелперы количеств приёма работы: ввод, форматирование, округление.

export const fmtNum = (value) =>
  value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("ru-RU");

// Количества хранятся с точностью до 0.0001 — toLocaleString по умолчанию
// режет до 3 знаков.
export const fmtQty = (value) => Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 4 });

// Пока поле в фокусе — показываем как ввели (иначе пробелы группировки скакали
// бы под курсором на каждое нажатие). Разгруппированный вид только на blur.
export const fmtInputValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString("ru-RU", { maximumFractionDigits: 4 }) : value;
};

// Разрешаем только цифры и одну точку — остальное (пробелы форматирования,
// случайные символы) выкидываем при вводе. Запятая (десятичный разделитель на
// телефонной клавиатуре) считается точкой.
export const sanitizeNumericInput = (raw) => {
  let v = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = v.indexOf(".");
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
  return v;
};

export const roundQty = (value) => Math.round(value * 10000) / 10000;

export const qtyToString = (value) => String(roundQty(value));

// Приём могли выполнить несколько сотрудников: у основного стикера — доля первого,
// доли остальных лежат в sticker.shares. "Выполнено" и сумма — по всем сразу.
export const goodQuantity = (sticker) =>
  roundQty(
    (Number(sticker?.actual_quantity) || 0) +
      (sticker?.shares || []).reduce((sum, share) => sum + (Number(share.actual_quantity) || 0), 0),
  );

export const totalAmount = (sticker) =>
  Math.round(
    ((Number(sticker?.amount) || 0) +
      (sticker?.shares || []).reduce((sum, share) => sum + (Number(share.amount) || 0), 0)) *
      100,
  ) / 100;
