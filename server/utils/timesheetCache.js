// Простой in-memory кэш табеля (по образцу tenantCache в tenantMiddleware.js).
// Кэшируются только закрытые (прошлые) месяцы — текущий месяц ещё копит события
// каждый день и не кэшируется вовсе. TTL — подстраховка на случай пропущенной
// инвалидации; ручная инвалидация — через POST /timesheet/recalculate.
const TTL_MS = 6 * 60 * 60 * 1000;

const store = new Map();

function buildKey(tenantSchema, month, params) {
  return `${tenantSchema}:${month}:${JSON.stringify(params)}`;
}

export const timesheetCache = {
  get(tenantSchema, month, params) {
    const key = buildKey(tenantSchema, month, params);
    const entry = store.get(key);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }

    return entry.value;
  },

  set(tenantSchema, month, params, value) {
    const key = buildKey(tenantSchema, month, params);
    store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  },

  invalidateMonth(tenantSchema, month) {
    const prefix = `${tenantSchema}:${month}:`;
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },
};
