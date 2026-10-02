// Общее для веб- и Telegram-формы типа операции: значения по умолчанию, преобразование
// ответа сервера в форму и списки целей для связей (следующая / исправление / не выполнено).

export const UNIT_OPTIONS = ["kg", "pcs", "m"];
export const UNIT_LABEL_KEYS = { kg: "unitKg", pcs: "unitPcs", m: "unitM" };

export const COMPLEXITY_OPTIONS = ["simple", "medium", "hard"];
export const COMPLEXITY_LABEL_KEYS = {
  simple: "complexitySimple",
  medium: "complexityMedium",
  hard: "complexityHard",
};

export const COMPLEXITY_META = {
  simple: { color: "#16a34a", labelKey: "complexitySimple", level: 1 },
  medium: { color: "#f59e0b", labelKey: "complexityMedium", level: 2 },
  hard: { color: "#dc2626", labelKey: "complexityHard", level: 3 },
};

export const BOOLEAN_FIELDS = ["is_active", "is_final", "is_rework", "is_first", "allow_merge", "allow_incomplete"];

export const EMPTY_FORM = {
  name: "",
  unit: "",
  price: "",
  complexity: "",
  next_operation_type_ids: [],
  rework_operation_type_ids: [],
  incomplete_operation_type_ids: [],
  // Только у операции исправления: какую операцию она исправляет ("" — не задана).
  rework_target_operation_type_id: "",
  sort_order: 0,
  is_active: true,
  is_final: false,
  is_rework: false,
  is_first: false,
  allow_merge: false,
  allow_incomplete: false,
  employee_ids: [],
};

// Следующая — только не исправление, для исправления — только исправление; цель,
// которая под это уже не подходит, из формы убираем (иначе на сохранении ушёл бы старый id).
export const toForm = (data) => ({
  name: data.name || "",
  unit: data.unit || "",
  price: data.price ?? "",
  complexity: data.complexity || "",
  next_operation_type_ids: (data.nextOperations || [])
    .map((rel) => rel.nextOperationType)
    .filter((type) => type && !type.is_rework)
    .map((type) => type.id),
  rework_operation_type_ids: (data.reworkOperations || [])
    .map((rel) => rel.reworkOperationType)
    .filter((type) => type && type.is_rework)
    .map((type) => type.id),
  // Не выполненные возвращаются в обычную цепочку — исправление сюда не подходит.
  incomplete_operation_type_ids: (data.incompleteOperations || [])
    .map((rel) => rel.incompleteOperationType)
    .filter((type) => type && !type.is_rework)
    .map((type) => type.id),
  rework_target_operation_type_id: data.is_rework ? (data.rework_target_operation_type_id ?? "") : "",
  sort_order: data.sort_order ?? 0,
  is_active: data.is_active ?? true,
  is_final: data.is_final ?? false,
  is_rework: data.is_rework ?? false,
  is_first: data.is_first ?? false,
  allow_merge: data.allow_merge ?? false,
  allow_incomplete: data.allow_incomplete ?? false,
  employee_ids: (data.employees || []).map((e) => e.employee_id),
});

// Цели связей: активные типы (кроме самого) нужного вида плюс уже выбранные, которых среди
// активных больше нет (отключили) — иначе они молча пропали бы из формы и с сохранения ушёл бы
// не тот набор. Исправление: rework = true — цели только исправления, false — только обычные.
const linkOptions = (operationTypes, initialData, { rework, relations, relationKey, selectedIds }) => {
  const active = operationTypes.filter((type) => type.id !== initialData?.id && Boolean(type.is_rework) === rework);
  const known = new Set(active.map((type) => type.id));
  const orphans = (initialData?.[relations] || [])
    .map((rel) => rel[relationKey])
    .filter((type) => type && !known.has(type.id) && selectedIds.includes(type.id));
  return [...active, ...orphans];
};

// Исправляемая операция — обычный активный тип (не сам и не исправление) плюс уже выбранная,
// которой среди активных больше нет (отключили) — иначе она молча пропала бы из формы.
const reworkTargetOptions = (operationTypes, initialData) => {
  const active = operationTypes.filter((type) => type.id !== initialData?.id && !type.is_rework);
  const saved = initialData?.reworkTarget;
  return saved && !active.some((type) => type.id === saved.id) ? [...active, saved] : active;
};

export const buildLinkOptions = (operationTypes, initialData, form) => ({
  reworkTargetOptions: reworkTargetOptions(operationTypes, initialData),
  nextOptions: linkOptions(operationTypes, initialData, {
    rework: false,
    relations: "nextOperations",
    relationKey: "nextOperationType",
    selectedIds: form.next_operation_type_ids,
  }),
  reworkOptions: linkOptions(operationTypes, initialData, {
    rework: true,
    relations: "reworkOperations",
    relationKey: "reworkOperationType",
    selectedIds: form.rework_operation_type_ids,
  }),
  incompleteOptions: linkOptions(operationTypes, initialData, {
    rework: false,
    relations: "incompleteOperations",
    relationKey: "incompleteOperationType",
    selectedIds: form.incomplete_operation_type_ids,
  }),
});

// Правила зависимых полей формы при смене одного из них.
export const applyFormChange = (prev, name, value) => {
  const next = { ...prev, [name]: BOOLEAN_FIELDS.includes(name) ? value === true || value === "true" : value };
  // Последняя операция следующей не имеет — сбрасываем выбранные цели.
  if (name === "is_final" && next.is_final) next.next_operation_type_ids = [];
  // Исправление в распределение партии не попадает — первой быть не может.
  if (name === "is_rework" && next.is_rework) next.is_first = false;
  // Исправляемая операция есть только у операции исправления.
  if (name === "is_rework" && !next.is_rework) next.rework_target_operation_type_id = "";
  // Не выполненные не разрешены — выбранные для них операции больше не нужны.
  if (name === "allow_incomplete" && !next.allow_incomplete) next.incomplete_operation_type_ids = [];
  return next;
};
