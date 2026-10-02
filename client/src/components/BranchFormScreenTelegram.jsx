import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { addBranch, editBranchById, getBranchById, EmployeeService } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";

import ui from "./tg/TgUi.module.scss";
import {
  IconCheck,
  IconMapPin,
  IconWallet,
  IconChevronDown,
} from "./tg/tgIcons";

import styles from "./BranchFormScreenTelegram.module.scss";

const EMPTY_FORM = {
  name: "",
  director_id: "",
  region: "",
  address: "",
  bank_name: "",
  bank_account: "",
  inn: "",
  mfo: "",
  sort_order: "0",
  status: true,
};

// Экран добавления / правки филиала в Telegram: на весь экран поверх страницы,
// поля разложены по карточкам, «Сохранить» — в шапке справа.
// id не передан — добавление, иначе правка филиала с этим id.
const BranchFormScreenTelegram = ({ id, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { popScreen } = useScreenStack();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const closedRef = useRef(false);

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    popScreen();
  };

  useEffect(() => {
    (async () => {
      try {
        const [empRes, branchRes] = await Promise.all([
          EmployeeService.getActive(),
          isEdit ? getBranchById(id) : null,
        ]);

        if (empRes.success) setEmployees(empRes.data);

        if (branchRes?.success) {
          const b = branchRes.data;
          setForm({
            name: b.name || "",
            director_id: b.director_id ?? "",
            region: b.region || "",
            address: b.address || "",
            bank_name: b.bank_name || "",
            bank_account: b.bank_account || "",
            inn: b.inn || "",
            mfo: b.mfo || "",
            sort_order: b.sort_order ?? "0",
            status: b.status !== false,
          });
        }
      } catch (err) {
        console.error("Ошибка загрузки формы филиала:", err);
        showAlert(t("error"), "error");
        close();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const canSave = !loading && !saving && form.name.trim() !== "";

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        director_id: form.director_id || "",
        region: form.region.trim(),
        address: form.address.trim(),
        bank_name: form.bank_name.trim(),
        bank_account: form.bank_account.trim(),
        inn: form.inn.trim(),
        mfo: form.mfo.trim(),
        sort_order: form.sort_order,
        status: form.status,
      };

      const res = isEdit
        ? await editBranchById(id, payload)
        : await addBranch(payload);

      if (!res.success) throw new Error(t("error"));

      showAlert(t("success"), "success");
      onSaved?.();
      close();
    } catch (err) {
      console.error("Ошибка сохранения филиала:", err);
      showAlert(err.response?.data?.error || t("error"), "error");
      setSaving(false);
    }
  };

  const sectionHead = (icon, tone, title) => (
    <div className={styles.cardHead}>
      <span className={`${styles.cardIcon} ${styles[tone]}`}>{icon}</span>
      <h2 className={styles.cardTitle}>{title}</h2>
    </div>
  );

  return (
    <form className={styles.screen} onSubmit={submit}>
      <div className={styles.topGlass} />

      <header className={styles.head}>
        <h1 className={styles.title}>{isEdit ? t("editBranch") : t("addBranch")}</h1>
        <button type="submit" className={styles.saveBtn} disabled={!canSave}>
          <IconCheck />
          {saving ? t("loading") : t("save")}
        </button>
      </header>

      <div className={styles.scroll}>
        {loading ? (
          <div className={styles.sections}>
            <div className={styles.card}>
              <span className={styles.skLine} style={{ width: "30%" }} />
              <span className={styles.skLine} style={{ height: 48 }} />
              <span className={styles.skLine} style={{ width: "30%" }} />
              <span className={styles.skLine} style={{ height: 48 }} />
            </div>
          </div>
        ) : (
          <div className={styles.sections}>
            <section className={styles.card}>
              <div className={ui.field}>
                <label className={ui.label} htmlFor="branch-name">
                  {t("name")} <span className={ui.req}>*</span>
                </label>
                <input
                  id="branch-name"
                  className={ui.input}
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>

              <div className={ui.field}>
                <label className={ui.label} htmlFor="branch-director">
                  {t("director")}
                </label>
                <div className={styles.selectWrap}>
                  <select
                    id="branch-director"
                    className={`${ui.input} ${styles.select}`}
                    value={form.director_id}
                    onChange={(e) => setField("director_id", e.target.value)}
                  >
                    <option value="">{t("select")}</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeFullName}
                      </option>
                    ))}
                  </select>
                  <span className={styles.selectArrow}>
                    <IconChevronDown />
                  </span>
                </div>
              </div>

              {isEdit && (
                <div className={ui.field}>
                  <span className={ui.label}>{t("status")}</span>
                  <div className={styles.segment} role="tablist">
                    {[
                      { value: true, label: t("enabled") },
                      { value: false, label: t("disabled") },
                    ].map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        role="tab"
                        aria-selected={form.status === opt.value}
                        className={`${styles.segmentBtn} ${form.status === opt.value ? (opt.value ? styles.segmentOn : styles.segmentOff) : ""}`}
                        onClick={() => setField("status", opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className={styles.card}>
              {sectionHead(<IconMapPin />, "toneBlue", t("locationTitle"))}

              <div className={ui.grid2}>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="branch-region">
                    {t("region")}
                  </label>
                  <input
                    id="branch-region"
                    className={ui.input}
                    type="text"
                    value={form.region}
                    onChange={(e) => setField("region", e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="branch-sort">
                    {t("sortOrder")}
                  </label>
                  <input
                    id="branch-sort"
                    className={ui.input}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={form.sort_order}
                    onChange={(e) => setField("sort_order", e.target.value)}
                  />
                </div>
              </div>

              <div className={ui.field}>
                <label className={ui.label} htmlFor="branch-address">
                  {t("address")}
                </label>
                <input
                  id="branch-address"
                  className={ui.input}
                  type="text"
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  autoComplete="off"
                />
              </div>
            </section>

            <section className={styles.card}>
              {sectionHead(<IconWallet />, "toneAmber", t("requisitesTitle"))}

              <div className={ui.grid2}>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="branch-inn">
                    {t("inn")}
                  </label>
                  <input
                    id="branch-inn"
                    className={ui.input}
                    type="text"
                    inputMode="numeric"
                    value={form.inn}
                    onChange={(e) => setField("inn", e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="branch-mfo">
                    {t("mfo")}
                  </label>
                  <input
                    id="branch-mfo"
                    className={ui.input}
                    type="text"
                    inputMode="numeric"
                    value={form.mfo}
                    onChange={(e) => setField("mfo", e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className={ui.field}>
                <label className={ui.label} htmlFor="branch-bank-name">
                  {t("bankName")}
                </label>
                <input
                  id="branch-bank-name"
                  className={ui.input}
                  type="text"
                  value={form.bank_name}
                  onChange={(e) => setField("bank_name", e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className={ui.field}>
                <label className={ui.label} htmlFor="branch-bank-account">
                  {t("bankAccount")}
                </label>
                <input
                  id="branch-bank-account"
                  className={ui.input}
                  type="text"
                  inputMode="numeric"
                  value={form.bank_account}
                  onChange={(e) => setField("bank_account", e.target.value)}
                  autoComplete="off"
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </form>
  );
};

export default BranchFormScreenTelegram;
