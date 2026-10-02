export const sortTimesheetEmployees = (data, sortField, sortOrder) => {
  return [...data].sort((a, b) => {
    let aVal = a[sortField] ?? "";
    let bVal = b[sortField] ?? "";

    if (sortField === "totalWorkedDays")
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;

    if (/^\d{2}:\d{2}$/.test(aVal)) {
      const [ah, am] = aVal.split(":").map(Number);
      const [bh, bm] = bVal.split(":").map(Number);
      return sortOrder === "asc"
        ? ah * 60 + am - (bh * 60 + bm)
        : bh * 60 + bm - (ah * 60 + am);
    }

    return sortOrder === "asc"
      ? String(aVal).localeCompare(String(bVal), "ru", {
          sensitivity: "base",
        })
      : String(bVal).localeCompare(String(aVal), "ru", {
          sensitivity: "base",
        });
  });
};
