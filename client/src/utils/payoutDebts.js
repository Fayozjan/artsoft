// Переносов между месяцами нет: остаток месяца остаётся на своём месяце.
// `own` — собственный долг месяца, он же `remaining`; поле сохранено, потому
// что на него завязаны формы оплаты и распределение платежа.
export function monthDebts(months = []) {
  return [...months]
    .sort((a, b) => a.month - b.month)
    .map((m) => ({ ...m, own: Math.max(0, Number(m.remaining || 0)) }));
}

// Maps the allocation onto the payroll items the bulk endpoint expects,
// oldest-first — paying an older month lowers the carry of the later ones.
export function toPaymentEntries(parts, months = []) {
  return parts
    .map((part) => {
      const target = months.find((m) => m.month === part.month);
      return target ? { item_id: target.item_id, amount: part.amount } : null;
    })
    .filter(Boolean);
}

// Oldest-first allocation of a payment; the parts always add up to the amount.
export function distributePayment(amount, months = []) {
  let left = Number(amount) || 0;
  const parts = [];

  for (const m of monthDebts(months)) {
    if (left <= 0) break;
    if (m.own <= 0) continue;
    const take = Math.min(left, m.own);
    parts.push({ month: m.month, amount: take });
    left -= take;
  }

  return parts;
}
