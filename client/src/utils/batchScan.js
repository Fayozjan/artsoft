// Порядок полей в DataMatrix/QR партии, разделены ';'. Дата прихода и номер документа
// в скан не входят — генерируются на сервере. product_name — 4-е поле,
// идёт сразу после названия компании (customer).
export const SCAN_FIELDS = [
  "batch_number",
  "order_number",
  "customer",
  "product_name",
  "color",
  "color_variant",
  "color_tone",
  "size",
  "yarn_type",
  "material",
  "design",
  "quantity",
  "gross_weight_kg",
  "roll_count",
  "grammage",
];

// Скан должен содержать минимум до Кол-во включительно — без него позиция бессмысленна.
export const MIN_FIELDS = SCAN_FIELDS.indexOf("quantity") + 1;

// Разделитель полей в баркоде — ';'. Если сканер шлёт US-раскладку, а в ОС
// активна RU, физическая клавиша ';' приходит как 'Ж' (Windows ЙЦУКЕН) —
// принимаем оба варианта, пока раскладку сканера/ОС не приведут в соответствие.
export const parseScan = (raw) => {
  const parts = raw.split(/[;Ж]/).map((p) => p.trim());
  if (parts.length < MIN_FIELDS || !parts[MIN_FIELDS - 1]) return null;

  const result = {};
  SCAN_FIELDS.forEach((key, i) => {
    result[key] = parts[i] ?? "";
  });
  return result;
};
