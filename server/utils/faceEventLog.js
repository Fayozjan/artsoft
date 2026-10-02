// Разбор лога события Hikvision. Общий для webhook-контроллера и дампа
// сырых запросов — оба должны видеть событие одинаково.

export const parseMaybeJson = (value) => {
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// Прошивки шлют лог в трёх видах:
//  1) поле формы event_log — JSON-строка с полным логом
//  2) поле формы AccessControllerEvent — тоже ПОЛНЫЙ лог строкой, внутри
//     которого лежит ещё один AccessControllerEvent с самим событием
//  3) обычный application/json — полный лог прямо в теле
//
// Случай (2) — обёртка: после парсинга наружный объект содержит один ключ,
// а настоящий лог внутри. Разворачиваем, пока не дойдём до уровня, где
// AccessControllerEvent — это событие (majorEventType/subEventType), а не
// очередной лог (eventType/вложенный AccessControllerEvent).
export function normalizeFaceEventLog(raw) {
  let log = parseMaybeJson(raw);
  if (!log || typeof log !== "object") return null;

  for (let depth = 0; depth < 3; depth++) {
    const inner = parseMaybeJson(log.AccessControllerEvent);

    // Лог без вложенного события — heartBeat и прочие служебные.
    // Без eventType это не лог, а посторонний JSON.
    if (!inner) return log.eventType ? log : null;

    if (inner.eventType || inner.AccessControllerEvent) {
      log = inner;
      continue;
    }

    return { ...log, AccessControllerEvent: inner };
  }

  return null;
}
