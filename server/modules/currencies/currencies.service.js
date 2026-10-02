import { CurrencyModel } from "./currencies.model.js";
import { fetchCbuRate } from "../../utils/cbuExchangeRate.js";
import { createAuditLog } from "../../utils/auditLog.js";

const trim = (value, max) =>
  typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;

export const CurrenciesService = {
  getCurrencies: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.OR = [
        { code: { contains: filters.search, mode: "insensitive" } },
        { name: { contains: filters.search, mode: "insensitive" } },
      ];
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";

    const [data, total] = await Promise.all([
      CurrencyModel.findMany({ where, skip, take: limit }),
      CurrencyModel.count(where),
    ]);

    return {
      data,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getActiveCurrencies: async () => CurrencyModel.findActive(),

  getCurrencyById: async (id) => CurrencyModel.findUnique(id),

  addCurrency: async ({ code, name, symbol, is_base = false, status = true }, userId) => {
    if (!code || !trim(code, 10)) throw new Error("Не указан код валюты");
    if (!name || !trim(name, 100)) throw new Error("Не указано название валюты");

    const result = await CurrencyModel.createWithBaseSwap({
      code: trim(code, 10).toUpperCase(),
      name: trim(name, 100),
      symbol: trim(symbol, 10),
      is_base: Boolean(is_base),
      status: status === true || status === "true",
    });
    await createAuditLog({ userId, action: "create", entity: "currencies", recordId: result.id, newData: result });
    return result;
  },

  editCurrencyById: async (id, { code, name, symbol, is_base, status }, userId) => {
    const old = await CurrencyModel.findUnique(id);
    if (!old) throw new Error("Валюта не найдена");

    const result = await CurrencyModel.updateWithBaseSwap(id, {
      code: code !== undefined ? trim(code, 10)?.toUpperCase() : undefined,
      name: name !== undefined ? trim(name, 100) : undefined,
      symbol: symbol !== undefined ? trim(symbol, 10) : undefined,
      is_base,
      status: status !== undefined ? status === true || status === "true" : undefined,
    });
    await createAuditLog({ userId, action: "update", entity: "currencies", recordId: id, oldData: old, newData: result });
    return result;
  },

  deleteCurrencyById: async (id, userId) => {
    const old = await CurrencyModel.findUnique(id);
    if (!old) return null;
    const result = await CurrencyModel.delete(id);
    await createAuditLog({ userId, action: "delete", entity: "currencies", recordId: id, oldData: old });
    return result;
  },

  // Рекомендованный курс на дату документа: для базовой валюты всегда 1 (без
  // похода в сеть), для остальных — курс ЦБ РУз по её ISO-коду (currency.code).
  getRecommendedRate: async (id, isoDate) => {
    const currency = await CurrencyModel.findUnique(id);
    if (!currency) throw new Error("Валюта не найдена");
    if (currency.is_base) return { rate: 1, date: isoDate, source: "base" };

    const { rate, date } = await fetchCbuRate(currency.code, isoDate);
    return { rate, date, source: "cbu" };
  },
};
