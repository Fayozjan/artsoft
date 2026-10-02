// Одинаковый ли набор id: порядок не важен, строки и числа равны ("5" и 5).
export const sameIdSet = (a = [], b = []) => {
  const setA = new Set(a.map(Number));
  const setB = new Set(b.map(Number));
  return setA.size === setB.size && [...setA].every((id) => setB.has(id));
};
