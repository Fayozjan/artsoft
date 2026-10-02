import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { addWorkSchedule, editWorkScheduleById, getWorkScheduleById } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";
import { formatHoursMinutes } from "../utils/date";

import ui from "./tg/TgUi.module.scss";
import {
  IconCheck,
  IconClock,
  IconLayers,
  IconSliders,
  IconHome,
  IconAlarm,
  IconLogOut,
  IconCopy,
  IconCoffee,
} from "./tg/tgIcons";

import styles from "./WorkScheduleFormScreenTelegram.module.scss";

const TYPE_OPTIONS = [
  { value: "fixed", icon: IconClock, color: "#6366f1" },
  { value: "shift", icon: IconLayers, color: "#8b5cf6" },
  { value: "flexible", icon: IconSliders, color: "#f59e0b" },
  { value: "remote", icon: IconHome, color: "#0ea5e9" },
];

const buildWorkDays = () =>
  Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    start: "",
    end: "",
    break_start: "",
    break_end: "",
  }));

const buildShifts = () =>
  Array.from({ length: 3 }, (_, i) => ({
    shift_number: i + 1,
    start: "",
    end: "",
    break_start: "",
    break_end: "",
  }));

const getBreakMinutes = (breakStart, breakEnd) => {
  if (!breakStart || !breakEnd) return 0;
  const [bsh, bsm] = breakStart.split(":").map(Number);
  const [beh, bem] = breakEnd.split(":").map(Number);
  return Math.max(0, beh * 60 + bem - (bsh * 60 + bsm));
};

const getMinutesWorked = (start, end, breakStart, breakEnd) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm) - getBreakMinutes(breakStart, breakEnd);
  return minutes > 0 ? minutes : 0;
};

// Строка «время начала – конца» + перерыв; используется и для дней, и для смен.
const TimeRangeRow = ({ label, start, end, breakStart, breakEnd, onChange }) => (
  <div className={styles.dayRow}>
    <span className={styles.dayName}>{label}</span>
    <div className={styles.dayFields}>
      <input
        className={styles.timeInput}
        type="time"
        value={start}
        onChange={(e) => onChange("start", e.target.value)}
      />
      <span className={styles.dayDash}>–</span>
      <input
        className={styles.timeInput}
        type="time"
        value={end}
        onChange={(e) => onChange("end", e.target.value)}
      />
      <span className={styles.breakIcon}>
        <IconCoffee />
      </span>
      <input
        className={styles.timeInput}
        type="time"
        value={breakStart}
        onChange={(e) => onChange("break_start", e.target.value)}
      />
      <span className={styles.dayDash}>–</span>
      <input
        className={styles.timeInput}
        type="time"
        value={breakEnd}
        onChange={(e) => onChange("break_end", e.target.value)}
      />
    </div>
  </div>
);

// Экран добавления / правки рабочего графика в Telegram: на весь экран поверх
// страницы, тип выбирается плитками, дни/смены — построчно, снизу живой
// подсчёт итоговых часов в неделю с предупреждением о превышении нормы.
// id не передан — добавление, иначе правка графика с этим id.
const WorkScheduleFormScreenTelegram = ({ id, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { popScreen } = useScreenStack();
  const isEdit = Boolean(id);
  const closedRef = useRef(false);

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    popScreen();
  };

  const [form, setForm] = useState({
    name: "",
    type: "fixed",
    weekly_days: 5,
    weekly_hours: 40,
    work_days: buildWorkDays(),
    shifts: buildShifts(),
    status: true,
    late_tolerance_minutes: 0,
    early_leave_tolerance_minutes: 0,
    late_leave_tolerance_minutes: 0,
    time_calc_method: "by_period",
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await getWorkScheduleById(id);
        if (!res.success) throw new Error(t("error"));

        const workDaysTemplate = buildWorkDays();
        const shiftsTemplate = buildShifts();
        setForm({
          ...res.data,
          weekly_days: Number(res.data.weekly_days) || 5,
          weekly_hours: Number(res.data.weekly_hours) || 40,
          work_days: workDaysTemplate.map((day, i) => ({
            ...day,
            ...(res.data.work_days?.[i] || {}),
          })),
          shifts: shiftsTemplate.map((shift, i) => ({
            ...shift,
            ...(res.data.shifts?.[i] || {}),
          })),
          status: res.data.status !== false,
          late_tolerance_minutes: Number(res.data.late_tolerance_minutes) || 0,
          early_leave_tolerance_minutes: Number(res.data.early_leave_tolerance_minutes) || 0,
          late_leave_tolerance_minutes: Number(res.data.late_leave_tolerance_minutes) || 0,
          time_calc_method: res.data.time_calc_method || "by_period",
        });
      } catch (err) {
        console.error("Ошибка загрузки графика:", err);
        showAlert(t("error"), "error");
        close();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const totalMinutes = useMemo(() => {
    if (form.type === "fixed" || form.type === "remote") {
      return form.work_days
        .slice(0, form.weekly_days)
        .reduce(
          (sum, day) => sum + getMinutesWorked(day.start, day.end, day.break_start, day.break_end),
          0,
        );
    }
    if (form.type === "shift") {
      return form.shifts.reduce(
        (sum, shift) => sum + getMinutesWorked(shift.start, shift.end, shift.break_start, shift.break_end),
        0,
      );
    }
    return 0;
  }, [form.work_days, form.shifts, form.weekly_days, form.type]);

  const totalHours = totalMinutes / 60;
  const showTotal = form.type !== "flexible";
  const exceeded = showTotal && totalHours > form.weekly_hours;
  const meterPercent = form.weekly_hours > 0 ? Math.min(100, (totalHours / form.weekly_hours) * 100) : 0;

  const setWeeklyDays = (value) =>
    setForm((prev) => ({ ...prev, weekly_days: value }));

  const setDayField = (index, field, value) =>
    setForm((prev) => {
      const work_days = [...prev.work_days];
      work_days[index] = { ...work_days[index], [field]: value };
      return { ...prev, work_days };
    });

  const setShiftField = (index, field, value) =>
    setForm((prev) => {
      const shifts = [...prev.shifts];
      shifts[index] = { ...shifts[index], [field]: value };
      return { ...prev, shifts };
    });

  const copyFirstDayToAll = () =>
    setForm((prev) => {
      const first = prev.work_days[0];
      const work_days = prev.work_days.map((day, i) =>
        i === 0 || i >= prev.weekly_days
          ? day
          : { ...day, start: first.start, end: first.end, break_start: first.break_start, break_end: first.break_end },
      );
      return { ...prev, work_days };
    });

  const canSave = !loading && !saving && form.name.trim() && !exceeded;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (exceeded) {
      showAlert(t("hoursExceedLimit"), "error");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim() };
      if (form.type === "fixed" || form.type === "remote") {
        delete payload.shifts;
      } else if (form.type === "shift") {
        delete payload.work_days;
        delete payload.weekly_days;
      } else if (form.type === "flexible") {
        delete payload.work_days;
        delete payload.shifts;
        delete payload.weekly_days;
      }

      if (isEdit) {
        await editWorkScheduleById(id, payload);
      } else {
        await addWorkSchedule(payload);
      }

      showAlert(t("success"), "success");
      onSaved?.();
      close();
    } catch (err) {
      console.error("Ошибка сохранения графика:", err);
      showAlert(err.response?.data?.error || t("error"), "error");
      setSaving(false);
    }
  };

  const dayNames = [t("dayMon"), t("dayTue"), t("dayWed"), t("dayThu"), t("dayFri"), t("daySat"), t("daySun")];
  const showDays = form.type === "fixed" || form.type === "remote";
  const showShifts = form.type === "shift";
  const showFlexNotice = form.type === "flexible";

  return (
    <form className={styles.screen} onSubmit={submit}>
      <div className={styles.topGlass} />

      <header className={styles.head}>
        <h1 className={styles.title}>{isEdit ? t("editWorkSchedule") : t("addWorkSchedule")}</h1>
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
                <label className={ui.label} htmlFor="ws-name">
                  {t("name")} <span className={ui.req}>*</span>
                </label>
                <input
                  id="ws-name"
                  className={ui.input}
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  autoComplete="off"
                  required
                />
              </div>

              <div className={ui.field}>
                <span className={ui.label}>{t("type")}</span>
                <div className={styles.typeGrid}>
                  {TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = form.type === opt.value;
                    const label = opt.value === "remote" ? t("remote") : t(`scheduleType.${opt.value}`);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={`${styles.typeBtn} ${active ? styles.typeBtnActive : ""}`}
                        style={active ? { "--tc": opt.color } : undefined}
                        onClick={() => setForm((p) => ({ ...p, type: opt.value }))}
                      >
                        <span className={styles.typeBtnIcon} style={{ color: opt.color }}>
                          <Icon />
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className={styles.card}>
              <div className={ui.field}>
                <label className={ui.label} htmlFor="ws-hours">
                  {t("weeklyHoursNorm")}
                </label>
                <input
                  id="ws-hours"
                  className={ui.input}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.weekly_hours}
                  onChange={(e) => setForm((p) => ({ ...p, weekly_hours: Number(e.target.value) }))}
                />
              </div>

              {showDays && (
                <div className={ui.field}>
                  <span className={ui.label}>{t("workWeek")}</span>
                  <div className={styles.segment} role="tablist">
                    {[5, 6, 7].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="tab"
                        aria-selected={form.weekly_days === n}
                        className={`${styles.segmentBtn} ${form.weekly_days === n ? styles.segmentOn : ""}`}
                        onClick={() => setWeeklyDays(n)}
                      >
                        {n} {t("days")}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showDays && (
                <div className={ui.field}>
                  <span className={ui.label}>{t("timeCalcMethod")}</span>
                  <div className={styles.segment} role="tablist">
                    {[
                      { value: "by_period", label: t("timeCalcByPeriod") },
                      { value: "first_last", label: t("timeCalcFirstLast") },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="tab"
                        aria-selected={form.time_calc_method === opt.value}
                        className={`${styles.segmentBtn} ${form.time_calc_method === opt.value ? styles.segmentOn : ""}`}
                        onClick={() => setForm((p) => ({ ...p, time_calc_method: opt.value }))}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {showDays && (
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardIcon}>
                    <IconClock />
                  </span>
                  <h2 className={styles.cardTitle}>{t("workMode")}</h2>
                  {form.weekly_days > 1 && (
                    <button type="button" className={styles.copyBtn} onClick={copyFirstDayToAll}>
                      <IconCopy />
                      {t("copyToAllDays")}
                    </button>
                  )}
                </div>

                <div className={styles.dayList}>
                  {form.work_days.slice(0, form.weekly_days).map((day, index) => (
                    <TimeRangeRow
                      key={day.day}
                      label={dayNames[index]}
                      start={day.start}
                      end={day.end}
                      breakStart={day.break_start}
                      breakEnd={day.break_end}
                      onChange={(field, value) => setDayField(index, field, value)}
                    />
                  ))}
                </div>
              </section>
            )}

            {showShifts && (
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardIcon}>
                    <IconLayers />
                  </span>
                  <h2 className={styles.cardTitle}>{t("workMode")}</h2>
                </div>

                <div className={styles.dayList}>
                  {form.shifts.map((shift, index) => (
                    <TimeRangeRow
                      key={shift.shift_number}
                      label={`${t("shift2Label")} ${shift.shift_number}`}
                      start={shift.start}
                      end={shift.end}
                      breakStart={shift.break_start}
                      breakEnd={shift.break_end}
                      onChange={(field, value) => setShiftField(index, field, value)}
                    />
                  ))}
                </div>
              </section>
            )}

            {showFlexNotice && (
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardIcon}>
                    <IconSliders />
                  </span>
                  <h2 className={styles.cardTitle}>{t("workMode")}</h2>
                </div>
                <p className={styles.flexNotice}>{t("flexibleSchedule")}</p>
              </section>
            )}

            {showTotal && (
              <section className={styles.card}>
                <div className={styles.totalHead}>
                  <span>{t("totalWeeklyHours")}</span>
                  <b className={exceeded ? styles.totalExceeded : ""}>
                    {formatHoursMinutes(totalMinutes)}
                    <small> / {form.weekly_hours}{t("hoursShort")}</small>
                  </b>
                </div>
                <div className={styles.totalTrack}>
                  <span
                    className={`${styles.totalFill} ${exceeded ? styles.totalFillOver : ""}`}
                    style={{ width: `${meterPercent}%` }}
                  />
                </div>
                {exceeded && <p className={styles.totalWarning}>{t("exceedsHoursLimit")}</p>}
              </section>
            )}

            <section className={styles.card}>
              <div className={ui.field}>
                <span className={`${ui.label} ${styles.labelIcon}`}>
                  <IconAlarm />
                  {t("lateToleranceMin")}
                </span>
                <input
                  className={ui.input}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.late_tolerance_minutes}
                  onChange={(e) => setForm((p) => ({ ...p, late_tolerance_minutes: Number(e.target.value) }))}
                />
              </div>

              <div className={ui.field}>
                <span className={`${ui.label} ${styles.labelIcon}`}>
                  <IconLogOut />
                  {t("earlyLeaveToleranceMin")}
                </span>
                <input
                  className={ui.input}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.early_leave_tolerance_minutes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, early_leave_tolerance_minutes: Number(e.target.value) }))
                  }
                />
              </div>

              <div className={ui.field}>
                <span className={`${ui.label} ${styles.labelIcon}`}>
                  <IconLogOut />
                  {t("lateLeaveToleranceMin")}
                </span>
                <input
                  className={ui.input}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.late_leave_tolerance_minutes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, late_leave_tolerance_minutes: Number(e.target.value) }))
                  }
                />
              </div>
            </section>

            {isEdit && (
              <section className={styles.card}>
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
                      className={`${styles.segmentBtn} ${form.status === opt.value ? (opt.value ? styles.segmentGreen : styles.segmentOff) : ""}`}
                      onClick={() => setForm((p) => ({ ...p, status: opt.value }))}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </form>
  );
};

export default WorkScheduleFormScreenTelegram;
