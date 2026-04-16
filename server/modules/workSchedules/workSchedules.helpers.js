const stripSeconds = (t) => (typeof t === "string" ? t.slice(0, 5) : t);

export const mapWorkDays = (work_days, weekly_days) =>
  (work_days || []).slice(0, Number(weekly_days || 0)).map((d) => ({
    day: d.day,
    start: stripSeconds(d.start) || "",
    end: stripSeconds(d.end) || "",
    break_start: stripSeconds(d.break_start) || "",
    break_end: stripSeconds(d.break_end) || "",
    // break_minutes: для обратной совместимости; если есть break_start/break_end — игнорируется
    break_minutes: Number(d.break_minutes) || 0,
  }));

export const mapShifts = (shifts) =>
  (shifts || [])
    .filter((s) => s.start || s.end)
    .map((s) => ({
      shift_number: s.shift_number,
      start: stripSeconds(s.start) || "",
      end: stripSeconds(s.end) || "",
      break_start: stripSeconds(s.break_start) || "",
      break_end: stripSeconds(s.break_end) || "",
      break_minutes: Number(s.break_minutes) || 0,
    }));
