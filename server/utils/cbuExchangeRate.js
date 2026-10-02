import axios from "axios";

const CBU_URL = (dateStr) => `https://cbu.uz/ru/arkhiv-kursov-valyut/json/all/${dateStr}/`;

const toCbuDate = (date) =>
  `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;

// До 5 попыток на предыдущие дни — защита от сетевого сбоя/отсутствия валюты
// в списке. В норме ЦБ сам отдаёт последний доступный день на любую дату
// (включая выходные и будущие даты), так что второй попытки почти не бывает.
export const fetchCbuRate = async (ccyCode, isoDate) => {
  const date = isoDate ? new Date(isoDate) : new Date();

  for (let i = 0; i < 5; i++) {
    try {
      const { data } = await axios.get(CBU_URL(toCbuDate(date)), { timeout: 5000 });
      const entry = Array.isArray(data) ? data.find((c) => c.Ccy === ccyCode) : null;
      if (entry) {
        return { rate: Number(entry.Rate) / Number(entry.Nominal || 1), date: entry.Date };
      }
    } catch {
      // сетевой сбой — пробуем день раньше
    }
    date.setDate(date.getDate() - 1);
  }

  const err = new Error("Курс ЦБ недоступен");
  err.code = "CBU_RATE_UNAVAILABLE";
  throw err;
};
