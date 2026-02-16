export const parseDateOnly = (str) => {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export function removeUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined),
  );
}
