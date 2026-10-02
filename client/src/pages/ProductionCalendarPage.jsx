import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  CalendarOff,
  PartyPopper,
  Scissors,
  Save,
  Trash2,
} from "lucide-react";

import { usePermissions } from "../hooks/usePermissions";
import { useAlertStore } from "../stores/alertStore";
import {
  getProductionCalendar,
  saveProductionCalendarDays,
  resetProductionCalendarDays,
} from "../api";

import Loading from "../components/Loading";
import CenterModal from "../components/CenterModal";
import { Icons } from "../icons/icons";

import styles from "./ProductionCalendarPage.module.scss";
import { useWidgetsStore } from "../stores/widgetsStore";

// Календарь задаёт только исключения поверх графика сотрудника.
// Дни без пометки приходят с day_type = "default" — работают по графику.
const DAY_TYPES = {
  WEEKEND: "weekend",
  HOLIDAY: "holiday",
  SHORT: "short",
};

const DEFAULT_SHORT_MINUTES = 60;

const StatWidget = ({ icon: Icon, color, label, value, sub }) => (
  <div className={styles.statWidget}>
    <div className={styles.statWidgetInner}>
      <div className={styles.statWidgetIcon} style={{ background: color + "18" }}>
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <div className={styles.statWidgetContent}>
        <span className={styles.statWidgetLabel}>{label}</span>
        <span className={styles.statWidgetValue} style={{ color }}>
          {value}
          {sub && <span className={styles.statWidgetSub}> {sub}</span>}
        </span>
      </div>
    </div>
  </div>
);

const ProductionCalendarPage = () => {
  const { t } = useTranslation();
  const { widgetsVisible } = useWidgetsStore();
  const { showAlert } = useAlertStore();

  const currentYear = new Date().getFullYear();
  const startYear = 2025;
  const years = Array.from(
    { length: currentYear - startYear + 2 },
    (_, i) => startYear + i,
  );

  const [year, setYear] = useState(currentYear);
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState(() => new Set());
  // Черновик формы: тип применяется только по «Сохранить», не по клику
  const [draftType, setDraftType] = useState(DAY_TYPES.WEEKEND);
  const [dayName, setDayName] = useState("");
  const [shortMinutes, setShortMinutes] = useState(DEFAULT_SHORT_MINUTES);
  const [showResetModal, setShowResetModal] = useState(false);
  const [widgetsScrollHidden, setWidgetsScrollHidden] = useState(false);
  const lastScrollTopRef = useRef(0);

  const handleTableScroll = (e) => {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;
    const lastScrollTop = lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    // мало данных — почти нечего скроллить, скрытие виджета меняет
    // высоту tableContainer и вызывает бесконечный hide/show (мигание)
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll < 40) {
      setWidgetsScrollHidden(false);
      return;
    }

    const delta = scrollTop - lastScrollTop;
    if (scrollTop <= 0) {
      setWidgetsScrollHidden(false);
    } else if (delta > 8) {
      setWidgetsScrollHidden(true);
    }
  };

  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);
  const canModify = canAdd || canEdit;

  const todayKey = useMemo(() => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getProductionCalendar({ year });
      setCalendar(data);
    } catch (err) {
      console.error("Ошибка при загрузке производственного календаря:", err.message);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [year, showAlert, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const dayByDate = useMemo(() => {
    const map = new Map();
    (calendar?.days || []).forEach((d) => map.set(d.date, d));
    return map;
  }, [calendar]);

  // Уже помеченные дни среди выделенных — для них доступно удаление пометки
  const savedSelectedDays = useMemo(
    () =>
      [...selected]
        .map((date) => dayByDate.get(date))
        .filter((day) => day?.is_override),
    [selected, dayByDate],
  );

  // Подставляем в форму данные уже сохранённых дней, чтобы их можно было
  // отредактировать. Для новых дней тип по умолчанию — доп. выходной.
  // Если выделены дни с разными типами/названиями — поле остаётся пустым,
  // чтобы случайно не перезаписать их одним значением.
  useEffect(() => {
    if (!savedSelectedDays.length) {
      setDraftType(DAY_TYPES.WEEKEND);
      setDayName("");
      setShortMinutes(DEFAULT_SHORT_MINUTES);
      return;
    }

    const types = new Set(savedSelectedDays.map((d) => d.day_type));
    setDraftType(types.size === 1 ? [...types][0] : null);

    const names = new Set(savedSelectedDays.map((d) => d.name || ""));
    setDayName(names.size === 1 ? [...names][0] : "");

    const short = savedSelectedDays.find((d) => d.day_type === DAY_TYPES.SHORT);
    setShortMinutes(short?.short_minutes || DEFAULT_SHORT_MINUTES);
  }, [savedSelectedDays]);

  const toggleDay = (date) => {
    if (!canModify && !canDelete) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  // Клик по названию месяца выделяет/снимает весь месяц целиком
  const toggleMonth = (monthDays) => {
    if (!canModify && !canDelete) return;
    const dates = monthDays.map((d) => d.date);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = dates.every((d) => next.has(d));
      dates.forEach((d) => (allSelected ? next.delete(d) : next.add(d)));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleSave = async () => {
    if (!draftType || !selected.size) return;

    const minutes = Number(shortMinutes) || DEFAULT_SHORT_MINUTES;
    const days = [...selected].map((date) => ({
      date,
      day_type: draftType,
      name: dayName.trim() || null,
      short_minutes: draftType === DAY_TYPES.SHORT ? minutes : null,
    }));

    setSaving(true);
    try {
      await saveProductionCalendarDays(days);
      showAlert(t("success"), "success");
      clearSelection();
      await fetchData();
    } catch (err) {
      console.error("Ошибка при сохранении дней календаря:", err.message);
      showAlert(err?.response?.data?.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const resetSelected = async () => {
    if (!selected.size) return;

    setSaving(true);
    try {
      await resetProductionCalendarDays([...selected]);
      showAlert(t("success"), "success");
      clearSelection();
      await fetchData();
    } catch (err) {
      console.error("Ошибка при сбросе дней календаря:", err.message);
      showAlert(err?.response?.data?.message || t("error"), "error");
    } finally {
      setSaving(false);
      setShowResetModal(false);
    }
  };

  const summary = calendar?.summary;

  return (
    <div className={styles.page}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          {widgetsVisible && summary && (
            <div
              className={`${styles.statsGridWrap} ${widgetsScrollHidden ? styles.statsGridWrapHidden : ""}`}
            >
              <div className={styles.statsGridInner}>
                <div className={styles.statsGrid}>
                  <StatWidget
                    icon={CalendarDays}
                    color="#0ea5e9"
                    label={t("totalCalendarDaysLabel")}
                    value={summary.totalDays}
                  />
                  <StatWidget
                    icon={CalendarOff}
                    color="#64748b"
                    label={t("weekendDaysLabel")}
                    value={summary.weekendDays}
                  />
                  <StatWidget
                    icon={PartyPopper}
                    color="#f59e0b"
                    label={t("holidayDaysLabel")}
                    value={summary.holidayDays}
                  />
                  <StatWidget
                    icon={Scissors}
                    color="#ec4899"
                    label={t("shortDaysLabel")}
                    value={summary.shortDays}
                  />
                </div>
              </div>
            </div>
          )}

          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <select
                value={year}
                onChange={(e) => {
                  clearSelection();
                  setYear(Number(e.target.value));
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

            </div>

            <div className={styles.legend}>
              <span className={`${styles.legendItem} ${styles.weekend}`}>{t("weekendDay")}</span>
              <span className={`${styles.legendItem} ${styles.holiday}`}>{t("holidayDay")}</span>
              <span className={`${styles.legendItem} ${styles.short}`}>{t("shortDay")}</span>
            </div>

            <div className={styles.buttonsWrapper}>
              <div className={styles.refreshBtn} onClick={fetchData}>
                {Icons.refresh}
              </div>
            </div>
          </div>

          {selected.size > 0 && (
            <div className={styles.selectionBar}>
              <span className={styles.selectionCount}>
                {t("selectedDays")}: <b>{selected.size}</b>
              </span>

              {canModify && (
                <>
                  <div className={styles.typeButtons} role="radiogroup">
                    {[
                      [DAY_TYPES.WEEKEND, t("weekendDay"), styles.weekend, CalendarOff],
                      [DAY_TYPES.HOLIDAY, t("holidayDay"), styles.holiday, PartyPopper],
                      [DAY_TYPES.SHORT, t("shortDay"), styles.short, Scissors],
                    ].map(([type, label, typeStyle, Icon]) => {
                      const isActive = draftType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          className={`${styles.typeBtn} ${typeStyle} ${
                            isActive ? styles.active : ""
                          }`}
                          disabled={saving}
                          onClick={() => setDraftType(type)}
                        >
                          <Icon size={14} strokeWidth={2.2} />
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    className={styles.nameInput}
                    type="text"
                    placeholder={t("dayNamePlaceholder")}
                    value={dayName}
                    onChange={(e) => setDayName(e.target.value)}
                  />

                  {/* Сокращение задаётся только для сокращённого дня */}
                  {draftType === DAY_TYPES.SHORT && (
                    <label className={styles.shortInput}>
                      {t("shortMinutesLabel")}
                      <input
                        type="number"
                        min="1"
                        max="1439"
                        value={shortMinutes}
                        onChange={(e) => setShortMinutes(e.target.value)}
                      />
                    </label>
                  )}
                </>
              )}

              <div className={styles.selectionActions}>
                {canModify && (
                  <button
                    type="button"
                    className={styles.saveBtn}
                    disabled={saving || !draftType}
                    title={!draftType ? t("selectDayTypeHint") : undefined}
                    onClick={handleSave}
                  >
                    <Save size={14} strokeWidth={2} />
                    {t("save")}
                  </button>
                )}

                {canDelete && savedSelectedDays.length > 0 && (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    disabled={saving}
                    title={t("resetToDefaultHint")}
                    onClick={() => setShowResetModal(true)}
                  >
                    <Trash2 size={14} strokeWidth={2} />
                    {t("delete")}
                  </button>
                )}

                <button
                  type="button"
                  className={styles.clearBtn}
                  disabled={saving}
                  onClick={clearSelection}
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}

          <div className={styles.calendarGrid} onScroll={handleTableScroll}>
            {(calendar?.months || []).map((monthData) => (
              <MonthCard
                key={monthData.month}
                monthData={monthData}
                t={t}
                selected={selected}
                todayKey={todayKey}
                onDayClick={toggleDay}
                onMonthClick={toggleMonth}
                dayByDate={dayByDate}
              />
            ))}
          </div>
        </div>
      )}

      <CenterModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onAccept={resetSelected}
        title={t("confirmResetDays", { count: selected.size })}
      />
    </div>
  );
};

// Пн–Вс: getUTCDay() отдаёт 0 для воскресенья, поэтому сдвигаем на понедельник
const WEEKDAY_KEYS = [1, 2, 3, 4, 5, 6, 7];

const MonthCard = ({
  monthData,
  t,
  selected,
  todayKey,
  onDayClick,
  onMonthClick,
}) => {
  const { month, days, summary } = monthData;

  // Сколько дней месяца помечено календарём (праздник / выходной / сокращённый)
  const marked =
    summary.holidayDays + summary.weekendDays + summary.shortDays;

  // Пустые ячейки перед первым числом, чтобы месяц начинался с нужного дня недели
  const leadingBlanks = useMemo(() => {
    if (!days.length) return 0;
    const first = new Date(`${days[0].date}T00:00:00Z`);
    return (first.getUTCDay() + 6) % 7;
  }, [days]);

  return (
    <div className={styles.monthCard}>
      <div className={styles.monthHeader} onClick={() => onMonthClick(days)}>
        <span className={styles.monthName}>{t(`months.${month}`)}</span>
        <span className={styles.monthMarks}>
          {marked > 0 ? `${marked} ${t("markedShort")}` : t("noMarks")}
        </span>
      </div>

      <div className={styles.weekDaysRow}>
        {WEEKDAY_KEYS.map((wd) => (
          <span key={wd} className={styles.weekDayLabel}>
            {t(`weekDaysShort.${wd}`)}
          </span>
        ))}
      </div>

      <div className={styles.daysGrid}>
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} className={styles.blankDay} />
        ))}

        {days.map((day) => {
          const dayNumber = Number(day.date.split("-")[2]);
          const classes = [
            styles.day,
            styles[day.day_type],
            selected.has(day.date) ? styles.selected : "",
            day.date === todayKey ? styles.today : "",
            day.is_override ? styles.override : "",
          ]
            .filter(Boolean)
            .join(" ");

          const title = [
            day.name,
            day.day_type === "short"
              ? `${t("shortDay")}: −${day.short_minutes} ${t("minutesShort")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <button
              key={day.date}
              type="button"
              className={classes}
              title={title || undefined}
              onClick={() => onDayClick(day.date)}
            >
              {dayNumber}
              {day.name && <span className={styles.dayDot} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProductionCalendarPage;
