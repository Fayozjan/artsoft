import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { EmployeeService, createTimeOff, getTimeOffById, updateTimeOff } from "../api";
import { formatIsoToDateTimeLocal } from "../utils/date";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";

import TgPickSheet from "./tg/TgPickSheet";
import ui from "./tg/TgUi.module.scss";
import { IconCheck, IconClose, IconUsers, IconPlus, IconClock, IconCalendar, IconSun, IconMessage } from "./tg/tgIcons";

import styles from "./TimeOffFormScreenTelegram.module.scss";

const EMPTY_FORM = {
  type: "hour",
  employeeIds: [],
  date_from: "",
  date_to: "",
  reason: "",
  is_company_paid: false,
};

const TYPE_OPTIONS = [
  { value: "hour", tone: "typeAmber", icon: <IconClock /> },
  { value: "day_off", tone: "typeBlue", icon: <IconCalendar /> },
  { value: "vacation", tone: "typePurple", icon: <IconSun /> },
];

const CARD_TONE = { hour: "toneAmber", day_off: "toneBlue", vacation: "tonePurple" };

const isFullDayType = (type) => type === "day_off" || type === "vacation";

// Экран добавления / правки заявки на отсутствие в Telegram: тип, сотрудники,
// период и причина — по карточкам, «Сохранить» — в шапке справа.
// id не передан — добавление (сразу нескольким сотрудникам), иначе правка одной записи.
const TimeOffFormScreenTelegram = ({ id, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { popScreen } = useScreenStack();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pick, setPick] = useState(false);

  const closedRef = useRef(false);

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    popScreen();
  };

  useEffect(() => {
    (async () => {
      try {
        const [empRes, recordRes] = await Promise.all([
          EmployeeService.getActive(),
          isEdit ? getTimeOffById(id) : null,
        ]);

        setEmployees(empRes?.success ? empRes.data : []);

        if (recordRes?.data) {
          const r = recordRes.data;
          const fullDay = isFullDayType(r.type);
          setForm({
            type: r.type,
            employeeIds: [Number(r.employee_id)],
            date_from: fullDay ? r.date_from.split("T")[0] : formatIsoToDateTimeLocal(r.date_from),
            date_to: fullDay ? r.date_to.split("T")[0] : formatIsoToDateTimeLocal(r.date_to),
            reason: r.reason || "",
            is_company_paid: Boolean(r.is_company_paid),
          });
        }
      } catch (err) {
        console.error("Ошибка загрузки формы заявки:", err);
        showAlert(t("errorLoading"), "error");
        close();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  // Формат даты у "часов" (datetime-local) и целых дней (date) разный —
  // при смене типа сбрасываем период, чтобы не тащить значение в чужом формате.
  const changeType = (type) => {
    if (type === form.type) return;
    setForm((prev) => ({ ...prev, type, date_from: "", date_to: "" }));
  };

  const removeEmployee = (employeeId) =>
    set("employeeIds", form.employeeIds.filter((eid) => eid !== employeeId));

  const selectedEmployees = useMemo(
    () => employees.filter((e) => form.employeeIds.includes(Number(e.id))),
    [employees, form.employeeIds],
  );

  const employeeOptions = useMemo(
    () =>
      employees.map((e) => ({
        id: Number(e.id),
        title: e.employeeFullName,
        subtitle: e.departmentName,
      })),
    [employees],
  );

  const isHourType = form.type === "hour";

  const canSave =
    !loading &&
    !saving &&
    form.employeeIds.length > 0 &&
    form.date_from &&
    form.date_to &&
    form.reason.trim().length > 0;

  const buildPayload = () => {
    const toIso = (v) => new Date(`${v}:00+05:00`).toISOString();
    const payload = {
      type: form.type,
      reason: form.reason.trim(),
      date_from: isHourType ? toIso(form.date_from) : form.date_from,
      date_to: isHourType ? toIso(form.date_to) : form.date_to,
      is_company_paid: form.is_company_paid,
    };

    if (isEdit) payload.employee_id = form.employeeIds[0];
    else payload.selectedEmployeeIds = form.employeeIds;

    return payload;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) await updateTimeOff(id, payload);
      else await createTimeOff(payload);

      showAlert(t("success"), "success");
      onSaved?.();
      close();
    } catch (err) {
      console.error("Ошибка сохранения заявки:", err);
      showAlert(err.response?.data?.error || err.message || t("error"), "error");
      setSaving(false);
    }
  };

  const sectionHead = (icon, tone, title, badge) => (
    <div className={styles.cardHead}>
      <span className={`${styles.cardIcon} ${styles[tone]}`}>{icon}</span>
      <h2 className={styles.cardTitle}>{title}</h2>
      {badge ? <span className={styles.total}>{badge}</span> : null}
    </div>
  );

  return (
    <form className={styles.screen} onSubmit={submit}>
      <div className={styles.topGlass} />

      <header className={styles.head}>
        <h1 className={styles.title}>{isEdit ? t("editTimeOff") : t("addTimeOff")}</h1>
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
              <span className={styles.skLine} style={{ height: 44 }} />
            </div>
            <div className={styles.card}>
              <span className={styles.skLine} style={{ width: "40%" }} />
              <span className={styles.skLine} style={{ height: 48 }} />
            </div>
          </div>
        ) : (
          <div className={styles.sections}>
            <section className={styles.card}>
              {sectionHead(
                TYPE_OPTIONS.find((o) => o.value === form.type)?.icon,
                CARD_TONE[form.type],
                t("type"),
              )}

              <div className={styles.typeGrid} role="tablist">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="tab"
                    aria-selected={form.type === opt.value}
                    className={`${styles.typeBtn} ${styles[opt.tone]} ${form.type === opt.value ? styles.typeBtnOn : ""}`}
                    onClick={() => changeType(opt.value)}
                  >
                    <span className={styles.typeIcon}>{opt.icon}</span>
                    {t(opt.value)}
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              {sectionHead(<IconUsers />, "toneBlue", t("employee"), selectedEmployees.length || null)}

              {selectedEmployees.length > 0 && (
                <ul className={styles.chipList}>
                  {selectedEmployees.map((emp) => (
                    <li key={emp.id} className={styles.chip}>
                      <span>{emp.employeeFullName}</span>
                      <button
                        type="button"
                        aria-label={t("delete")}
                        onClick={() => removeEmployee(Number(emp.id))}
                      >
                        <IconClose />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {(isEdit ? selectedEmployees.length === 0 : true) && (
                <button type="button" className={styles.addBtn} onClick={() => setPick(true)}>
                  <IconPlus />
                  {t("employee")}
                </button>
              )}
            </section>

            <section className={styles.card}>
              {sectionHead(<IconCalendar />, "toneAmber", t("period"))}

              <div className={ui.grid2}>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="to-date-from">
                    {t("dateFrom")} <span className={ui.req}>*</span>
                  </label>
                  <input
                    id="to-date-from"
                    className={ui.input}
                    type={isHourType ? "datetime-local" : "date"}
                    value={form.date_from}
                    onChange={(e) => set("date_from", e.target.value)}
                    onFocus={(e) => e.target.showPicker?.()}
                    required
                  />
                </div>
                <div className={ui.field}>
                  <label className={ui.label} htmlFor="to-date-to">
                    {t("dateTo")} <span className={ui.req}>*</span>
                  </label>
                  <input
                    id="to-date-to"
                    className={ui.input}
                    type={isHourType ? "datetime-local" : "date"}
                    value={form.date_to}
                    onChange={(e) => set("date_to", e.target.value)}
                    onFocus={(e) => e.target.showPicker?.()}
                    required
                  />
                </div>
              </div>
            </section>

            <section className={styles.card}>
              {sectionHead(<IconMessage />, "toneGreen", t("reason"))}

              <div className={ui.field}>
                <textarea
                  className={ui.textarea}
                  value={form.reason}
                  onChange={(e) => set("reason", e.target.value)}
                  placeholder={t("reason")}
                  required
                />
              </div>

              <label className={styles.switchRow}>
                <span className={styles.switchText}>
                  <b>{t("companyPaid")}</b>
                </span>
                <input
                  type="checkbox"
                  className={styles.switch}
                  checked={form.is_company_paid}
                  onChange={(e) => set("is_company_paid", e.target.checked)}
                />
              </label>
            </section>
          </div>
        )}
      </div>

      <TgPickSheet
        isOpen={pick}
        onClose={() => setPick(false)}
        title={t("employee")}
        single={isEdit}
        options={employeeOptions}
        selected={form.employeeIds}
        onChange={(ids) => set("employeeIds", ids)}
      />
    </form>
  );
};

export default TimeOffFormScreenTelegram;
