import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";
import styles from "./AdvanceDeduction.module.scss";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const clampAmount = (raw, max) => {
  const digits = String(raw).replace(/\D/g, "");
  if (digits === "") return "";
  return String(Math.min(Number(digits), Math.round(max)));
};

// Удержание аванса прямо в форме оплаты.
//
// Долг сотрудника общий: выданные займы плюс переплаты по месяцам минус всё
// удержанное. Переносов между месяцами нет, поэтому гасить можно из любого
// месяца, где остался остаток к выплате — кнопка и стоит там, где платят.
export default function AdvanceDeduction({ month, onChanged }) {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const debtDed = Number(month?.debt_deduction || 0);
  // Считает сервер: пришедший переносом долг плюс выданный в этом же месяце
  const left = Number(month?.deductible || 0);
  // Правим абсолютное значение поля, поэтому потолок включает уже удержанное
  const debtBal = left + debtDed;
  // Берём остаток, посчитанный сервером: он уже учитывает и выплаченное, и
  // текущее удержание. Своя формула пропускала месяцы, где выдавать уже нечего.
  //
  // `remaining` — то, что осталось после удержания; прибавляем удержание назад,
  // потому что в поле правится его АБСОЛЮТНОЕ значение, а не добавка.
  const payable = Math.max(0, Number(month?.remaining || 0) + debtDed);
  const maxDeduct = Math.min(debtBal, payable);

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  // Поле пустое: удержание — решение бухгалтера, а не действие по умолчанию
  useEffect(() => {
    setAmount("");
  }, [month?.item_id]);

  if (!month || left <= 0.5) return null;
  if (month.payout_status === "paid") return null;
  // Гасить нечем — блок не рисуем совсем, чтобы не выглядел рабочим
  if (maxDeduct <= 0.5 && debtDed <= 0) {
    return (
      <div className={styles.box}>
        <div className={styles.head}>
          <span className={styles.title}>{t("debtDeductionTitle")}</span>
          <span className={styles.value}>{fmt(left)}</span>
        </div>
        <div className={styles.note}>{t("nothingToDeduct")}</div>
      </div>
    );
  }

  const handleApply = async () => {
    setBusy(true);
    try {
      const value = Number(amount);
      const res = await payrollApi.updateItem(month.item_id, {
        debt_deduction: value,
        debt_mode: value > 0 ? "partial" : "skip",
      });
      if (!res.success) {
        showAlert(res.message || t("error"), "error");
        return;
      }
      showAlert(t("saved"), "success");
      onChanged?.();
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.box}>
      <div className={styles.head}>
        <span className={styles.title}>{t("debtDeductionTitle")}</span>
        <span className={styles.value}>{fmt(left)}</span>
      </div>

      {debtDed > 0 && (
        <div className={styles.row}>
          <span>{t("currentDeduction")}</span>
          <span className={styles.deducted}>−{fmt(debtDed)}</span>
        </div>
      )}

      {maxDeduct <= 0 ? (
        // Выплачивать нечего — удерживать не из чего, долг едет дальше
        <div className={styles.note}>{t("nothingToDeduct")}</div>
      ) : (
        <>
          <div className={styles.controls}>
            <input
              type="text"
              inputMode="numeric"
              className={styles.input}
              placeholder="0"
              value={amount ? fmt(amount) : ""}
              onChange={(e) =>
                setAmount(clampAmount(e.target.value, maxDeduct))
              }
            />
            <button
              className={styles.applyBtn}
              onClick={handleApply}
              disabled={busy || !amount || Number(amount) <= 0}
            >
              {t("applyDeduction")}
            </button>
          </div>
          <div className={styles.note}>
            {t("maxDeduct")}: {fmt(maxDeduct)}
          </div>
        </>
      )}
    </div>
  );
}
