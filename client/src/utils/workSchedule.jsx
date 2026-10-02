import { t } from "i18next";

const getDayNames = () => [
  t("dayMon"),
  t("dayTue"),
  t("dayWed"),
  t("dayThu"),
  t("dayFri"),
  t("daySat"),
  t("daySun"),
];

// Человекочитаемый режим работы графика: "Пн–Пт: 09:00 – 18:00"
// для fixed, список смен для shift, метка для flexible.
export const formatWorkScheduleTime = (schedule) => {
  if (!schedule) return "—";
  const dayNames = getDayNames();

  switch (schedule.type) {
    case "fixed":
    case "remote": {
      if (!schedule.work_days?.length) return "—";

      const activeDays = schedule.work_days.filter((d) => d.start && d.end);

      if (!activeDays.length) return "—";

      const groups = {};

      activeDays.forEach((day) => {
        const key = `${day.start}-${day.end}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(day.day);
      });

      return Object.entries(groups).map(([time, days], i) => {
        const [start, end] = time.split("-");

        const sortedDays = days.sort((a, b) => a - b);

        const isSequential =
          sortedDays[sortedDays.length - 1] - sortedDays[0] + 1 ===
          sortedDays.length;

        const daysLabel = isSequential
          ? `${dayNames[sortedDays[0] - 1]}–${
              dayNames[sortedDays[sortedDays.length - 1] - 1]
            }`
          : sortedDays.map((d) => dayNames[d - 1]).join(", ");

        return (
          <span key={i}>
            {daysLabel}: {start} – {end}
          </span>
        );
      });
    }

    case "shift": {
      const shifts = schedule.shifts
        ?.filter((s) => s.start && s.end)
        .map((s) => (
          <div key={s.shift_number}>
            {s.shift_number} {t("shift2Label")}: {s.start} – {s.end}
          </div>
        ));

      return shifts?.length ? shifts : "—";
    }

    case "flexible":
      return t("flexibleSchedule");

    default:
      return "—";
  }
};
