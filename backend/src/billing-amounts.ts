export function billingAmounts(invoice: { value: unknown; dueDate: Date; status: string }, now = new Date(), finePercent = 2, monthlyPercent = 1) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  // Due dates are calendar dates persisted as UTC, not local timestamps.
  const due = invoice.dueDate.toISOString().slice(0, 10);
  const open = ["open", "pending", "overdue", "expired"].includes(invoice.status);
  const daysLate = open ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(due)) / 86400000)) : 0;
  const principal = Math.round(Number(invoice.value) * 100);
  const fine = daysLate ? Math.round(principal * finePercent / 100) : 0;
  const interest = Math.round(principal * monthlyPercent * daysLate / 3000);
  return { daysLate, principalValue: principal / 100, fineValue: fine / 100, interestValue: interest / 100, payableValue: (principal + fine + interest) / 100 };
}
