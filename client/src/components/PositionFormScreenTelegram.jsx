import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { addPosition, editPositionById, getPositionById } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";

import ui from "./tg/TgUi.module.scss";
import { IconCheck } from "./tg/tgIcons";

import styles from "./PositionFormScreenTelegram.module.scss";

// Экран добавления / правки должности в Telegram: на весь экран поверх страницы.
// id не передан — добавление, иначе правка должности с этим id.
const PositionFormScreenTelegram = ({ id, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { popScreen } = useScreenStack();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({ name: "", sort_order: 0, status: true });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const closedRef = useRef(false);

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    popScreen();
  };

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await getPositionById(id);
        if (res.success) {
          setForm({
            name: res.data.name || "",
            sort_order: res.data.sort_order ?? 0,
            status: res.data.status === true || res.data.status === "true",
          });
        }
      } catch (err) {
        console.error("Ошибка загрузки должности:", err);
        showAlert(t("error"), "error");
        close();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canSave = !loading && !saving && form.name.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sort_order: Number(form.sort_order) || 0,
      };

      const res = isEdit
        ? await editPositionById(id, { ...payload, status: form.status })
        : await addPosition(payload);
      if (!res.success) throw new Error(t("error"));

      showAlert(t("success"), "success");
      onSaved?.();
      close();
    } catch (err) {
      console.error("Ошибка сохранения должности:", err);
      showAlert(err.response?.data?.error || t("error"), "error");
      setSaving(false);
    }
  };

  return (
    <form className={styles.screen} onSubmit={submit}>
      <div className={styles.topGlass} />

      <header className={styles.head}>
        <h1 className={styles.title}>
          {isEdit ? t("editPosition") : t("addPosition")}
        </h1>
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
                <label className={ui.label} htmlFor="pos-name">
                  {t("name")} <span className={ui.req}>*</span>
                </label>
                <input
                  id="pos-name"
                  className={ui.input}
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  autoComplete="off"
                  required
                />
              </div>

              <div className={ui.field}>
                <label className={ui.label} htmlFor="pos-sort">
                  {t("sortOrder")}
                </label>
                <input
                  id="pos-sort"
                  className={ui.input}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, sort_order: e.target.value }))
                  }
                />
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
                        onClick={() => setForm((p) => ({ ...p, status: opt.value }))}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </form>
  );
};

export default PositionFormScreenTelegram;
