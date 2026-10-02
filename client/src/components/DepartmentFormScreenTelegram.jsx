import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  addDepartment,
  editDepartmentById,
  getDepartmentById,
  getActiveBranches,
  getActivePositions,
} from "../api";
import { getStaffingPositions, saveStaffingPositions } from "../api/staffingPosition";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";

import ui from "./tg/TgUi.module.scss";
import {
  IconCheck,
  IconPlus,
  IconMinus,
  IconTrash,
  IconChevronDown,
  IconBriefcase,
} from "./tg/tgIcons";

import styles from "./DepartmentFormScreenTelegram.module.scss";

const toPayloadStaffing = (staffing) =>
  staffing.map(({ position_id, headcount }) => ({ position_id, headcount }));

// Экран добавления / правки отдела в Telegram: на весь экран поверх страницы,
// поля крупные, штат — список должностей со счётчиком «−/+».
// id не передан — добавление, иначе правка отдела с этим id.
const DepartmentFormScreenTelegram = ({ id, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { popScreen } = useScreenStack();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({ name: "", branch_id: "", status: true });
  const [branches, setBranches] = useState([]);
  const [positions, setPositions] = useState([]);
  const [staffing, setStaffing] = useState([]);
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
        const [branchRes, posRes, deptRes, staffingRes] = await Promise.all([
          getActiveBranches(),
          getActivePositions(),
          isEdit ? getDepartmentById(id) : null,
          isEdit ? getStaffingPositions(id) : null,
        ]);

        const branchList = branchRes.success ? branchRes.data : [];
        setBranches(branchList);
        if (posRes.success) setPositions(posRes.data);

        if (deptRes?.success) {
          setForm({
            name: deptRes.data.name || "",
            branch_id: deptRes.data.branch_id ?? "",
            status: deptRes.data.status !== false,
          });
        } else if (branchList.length === 1) {
          // единственный филиал выбираем сразу
          setForm((prev) => ({ ...prev, branch_id: branchList[0].id }));
        }

        if (staffingRes?.success) {
          setStaffing(
            (staffingRes.data || []).map((s) => ({
              position_id: Number(s.position_id),
              position_name: s.position_name,
              headcount: Number(s.headcount),
            })),
          );
        }
      } catch (err) {
        console.error("Ошибка загрузки формы отдела:", err);
        showAlert(t("error"), "error");
        close();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const staffedIds = useMemo(
    () => new Set(staffing.map((s) => s.position_id)),
    [staffing],
  );
  const freePositions = useMemo(
    () =>
      positions
        .filter((p) => !staffedIds.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [positions, staffedIds],
  );
  const totalHeadcount = staffing.reduce((sum, s) => sum + s.headcount, 0);

  const addPosition = (positionId) => {
    const pos = positions.find((p) => p.id === Number(positionId));
    if (!pos) return;
    setStaffing((prev) => [
      ...prev,
      { position_id: pos.id, position_name: pos.name, headcount: 1 },
    ]);
  };

  const setHeadcount = (positionId, value) =>
    setStaffing((prev) =>
      prev.map((s) =>
        s.position_id === positionId
          ? { ...s, headcount: Math.max(1, Number(value) || 1) }
          : s,
      ),
    );

  const removePosition = (positionId) =>
    setStaffing((prev) => prev.filter((s) => s.position_id !== positionId));

  const canSave = !loading && !saving && form.name.trim() && form.branch_id !== "";

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        branch_id: Number(form.branch_id),
      };

      if (isEdit) {
        const [res] = await Promise.all([
          editDepartmentById(id, { ...payload, status: form.status }),
          saveStaffingPositions(id, toPayloadStaffing(staffing)),
        ]);
        if (!res.success) throw new Error(t("error"));
      } else {
        const res = await addDepartment(payload);
        if (!res.success || !res.data?.id) throw new Error(t("error"));
        if (staffing.length > 0) {
          await saveStaffingPositions(res.data.id, toPayloadStaffing(staffing));
        }
      }

      showAlert(t("success"), "success");
      onSaved?.();
      close();
    } catch (err) {
      console.error("Ошибка сохранения отдела:", err);
      showAlert(err.response?.data?.error || t("error"), "error");
      setSaving(false);
    }
  };

  return (
    <form className={styles.screen} onSubmit={submit}>
      <div className={styles.topGlass} />

      <header className={styles.head}>
        <h1 className={styles.title}>
          {isEdit ? t("editDepartment") : t("addDepartment")}
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
                <label className={ui.label} htmlFor="dept-name">
                  {t("name")} <span className={ui.req}>*</span>
                </label>
                <input
                  id="dept-name"
                  className={ui.input}
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  autoComplete="off"
                  required
                />
              </div>

              <div className={ui.field}>
                <label className={ui.label} htmlFor="dept-branch">
                  {t("branch")} <span className={ui.req}>*</span>
                </label>
                <div className={styles.selectWrap}>
                  <select
                    id="dept-branch"
                    className={`${ui.input} ${styles.select}`}
                    value={form.branch_id}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, branch_id: Number(e.target.value) }))
                    }
                    required
                  >
                    <option value="" disabled>
                      {t("select")}
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
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
                        onClick={() => setForm((p) => ({ ...p, status: opt.value }))}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardIcon}>
                  <IconBriefcase />
                </span>
                <h2 className={styles.cardTitle}>{t("staffingPositionsLabel")}</h2>
                {staffing.length > 0 && (
                  <span className={styles.total}>{totalHeadcount}</span>
                )}
              </div>

              {staffing.length > 0 && (
                <ul className={styles.staffList}>
                  {staffing.map((s) => (
                    <li key={s.position_id} className={styles.staffRow}>
                      <span className={styles.staffName}>{s.position_name}</span>

                      <div className={styles.stepper}>
                        <button
                          type="button"
                          aria-label="−"
                          disabled={s.headcount <= 1}
                          onClick={() => setHeadcount(s.position_id, s.headcount - 1)}
                        >
                          <IconMinus />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={s.headcount}
                          onChange={(e) => setHeadcount(s.position_id, e.target.value)}
                          aria-label={t("headcount")}
                        />
                        <button
                          type="button"
                          aria-label="+"
                          onClick={() => setHeadcount(s.position_id, s.headcount + 1)}
                        >
                          <IconPlus />
                        </button>
                      </div>

                      <button
                        type="button"
                        className={styles.removeBtn}
                        aria-label={t("delete")}
                        onClick={() => removePosition(s.position_id)}
                      >
                        <IconTrash />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className={styles.selectWrap}>
                <select
                  className={`${ui.input} ${styles.select} ${styles.addSelect}`}
                  value=""
                  onChange={(e) => addPosition(e.target.value)}
                  disabled={freePositions.length === 0}
                >
                  <option value="" disabled>
                    {freePositions.length === 0
                      ? t("nothingFound")
                      : `+ ${t("position")}`}
                  </option>
                  {freePositions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className={styles.selectArrow}>
                  <IconChevronDown />
                </span>
              </div>
            </section>
          </div>
        )}
      </div>
    </form>
  );
};

export default DepartmentFormScreenTelegram;
