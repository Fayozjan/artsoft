// Стикер сотрудника: в QR / Data Matrix лежит "EMP-000123" (id сотрудника). Префикс
// отличает его от стикера работы ("ST-000123") в одном поле скана "Приём работы".
const EMPLOYEE_CODE_PREFIX = "EMP-";
const EMPLOYEE_CODE_RE = /^EMP-(\d+)$/i;

export const employeeStickerCode = (id) => `${EMPLOYEE_CODE_PREFIX}${String(id).padStart(6, "0")}`;

// id сотрудника из считанного кода или null, если это не стикер сотрудника.
export const parseEmployeeStickerCode = (code) => {
  const match = EMPLOYEE_CODE_RE.exec(String(code || "").trim());
  return match ? String(Number(match[1])) : null;
};
