/**
 * Эскалирующая блокировка входа.
 *
 * Считаем неудачные попытки по конкретному логину (арендатор + username),
 * а не по IP: блокируется только тот, кто ошибался.
 *
 * Порог неудач подряд -> блокировка. Каждая следующая блокировка того же
 * логина берёт следующий шаг лестницы: 5 -> 15 -> 30 -> 60 -> 120 -> 240 минут
 * (последний шаг повторяется). Успешный вход сбрасывает всё.
 */

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Неудач подряд до блокировки
export const FAIL_THRESHOLD = num(process.env.LOGIN_FAIL_THRESHOLD, 3);

// Лестница блокировок в минутах; последний шаг повторяется дальше
export const LOCK_LADDER_MIN = (process.env.LOGIN_LOCK_LADDER_MIN || "5,15,30,60,120,240")
  .split(",")
  .map((v) => Number(String(v).trim()))
  .filter((v) => Number.isFinite(v) && v > 0);

// Тишина дольше этого — счётчик неудач обнуляется
const FAIL_WINDOW_MS = num(process.env.LOGIN_FAIL_WINDOW_MIN, 30) * 60_000;

// Тишина дольше этого — уровень эскалации падает до нуля
const LEVEL_RESET_MS = num(process.env.LOGIN_LEVEL_RESET_HOURS, 24) * 3_600_000;

// Защита от разрастания памяти при переборе несуществующих логинов
const MAX_ENTRIES = num(process.env.LOGIN_LOCKOUT_MAX_ENTRIES, 10_000);

/** @type {Map<string, {fails:number, level:number, lockedUntil:number, lastFailAt:number, lockedAt:number}>} */
const entries = new Map();

const lockMsForLevel = (level) =>
  LOCK_LADDER_MIN[Math.min(level, LOCK_LADDER_MIN.length - 1)] * 60_000;

const emptyEntry = () => ({
  fails: 0,
  level: 0,
  lockedUntil: 0,
  lastFailAt: 0,
  lockedAt: 0,
});

const isIdle = (entry) => entry.fails === 0 && entry.level === 0 && entry.lockedUntil === 0;

// Снимает истёкшую блокировку и остывшие счётчики
const decay = (entry, now) => {
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    entry.lockedUntil = 0;
    entry.lockedAt = 0;
    entry.fails = 0;
    entry.lastFailAt = now; // отсчёт остывания уровня — от конца блокировки
  }

  if (entry.lockedUntil) return entry;

  const idleFor = now - entry.lastFailAt;
  if (entry.lastFailAt && idleFor > FAIL_WINDOW_MS) entry.fails = 0;
  if (entry.lastFailAt && idleFor > LEVEL_RESET_MS) entry.level = 0;

  return entry;
};

const evictIfNeeded = () => {
  if (entries.size <= MAX_ENTRIES) return;
  // Map хранит порядок вставки — выкидываем самые старые записи
  const excess = entries.size - MAX_ENTRIES;
  let i = 0;
  for (const key of entries.keys()) {
    if (i++ >= excess) break;
    entries.delete(key);
  }
};

const toStatus = (key, entry, now) => {
  const locked = entry.lockedUntil > now;
  const retryAfter = locked ? Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)) : 0;

  return {
    key,
    locked,
    retryAfter,
    retryAfterMinutes: locked ? Math.ceil(retryAfter / 60) : 0,
    lockedUntil: locked ? new Date(entry.lockedUntil).toISOString() : null,
    lockedAt: locked && entry.lockedAt ? new Date(entry.lockedAt).toISOString() : null,
    // сколько блокировок уже было: 1 = сейчас идёт первая
    lockLevel: entry.level,
    failCount: entry.fails,
    attemptsLeft: locked ? 0 : Math.max(0, FAIL_THRESHOLD - entry.fails),
  };
};

export const LoginLockout = {
  /** Ключ = арендатор + логин в нижнем регистре */
  buildKey: (tenant, username) =>
    `${tenant || "unknown"}:${String(username ?? "").trim().toLowerCase()}`,

  /** Текущий статус без изменения счётчиков */
  status: (key) => {
    const now = Date.now();
    const entry = entries.get(key);
    if (!entry) return toStatus(key, emptyEntry(), now);

    decay(entry, now);
    if (isIdle(entry)) entries.delete(key);

    return toStatus(key, entry, now);
  },

  /** Неудачная попытка. Возвращает статус — может уже содержать locked: true */
  registerFailure: (key) => {
    const now = Date.now();
    const entry = entries.get(key) ?? emptyEntry();
    decay(entry, now);

    // Попытка во время активной блокировки счётчик не двигает
    if (entry.lockedUntil > now) {
      entries.set(key, entry);
      return toStatus(key, entry, now);
    }

    entry.fails += 1;
    entry.lastFailAt = now;

    if (entry.fails >= FAIL_THRESHOLD) {
      entry.lockedUntil = now + lockMsForLevel(entry.level);
      entry.lockedAt = now;
      entry.level += 1;
      entry.fails = 0;
    }

    entries.set(key, entry);
    evictIfNeeded();

    return toStatus(key, entry, now);
  },

  /** Успешный вход — сбрасываем и счётчик, и уровень эскалации */
  reset: (key) => {
    entries.delete(key);
  },

  /** Снятие блокировки администратором. true — блокировка была */
  unlock: (key) => {
    const entry = entries.get(key);
    const wasLocked = !!entry && entry.lockedUntil > Date.now();
    entries.delete(key);
    return wasLocked;
  },

  /** Активные блокировки арендатора (для UI). tenantPrefix — схема арендатора */
  listLocked: (tenant) => {
    const now = Date.now();
    const prefix = `${tenant || "unknown"}:`;
    const result = [];

    for (const [key, entry] of entries) {
      decay(entry, now);
      if (isIdle(entry)) {
        entries.delete(key);
        continue;
      }
      if (!key.startsWith(prefix) || entry.lockedUntil <= now) continue;

      result.push({ username: key.slice(prefix.length), ...toStatus(key, entry, now) });
    }

    return result.sort((a, b) => a.username.localeCompare(b.username));
  },

  /** Только для тестов */
  _clear: () => entries.clear(),
};
