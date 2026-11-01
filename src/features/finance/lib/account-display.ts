export function cairoToday(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(new Date());
  const get = (name: string) => parts.find(part => part.type === name)?.value ?? "";
  return [get("year"), get("month"), get("day")].join("-");
}
export function balanceDescription(amount: string): string {
  if (/^-?0+(?:\.0+)?$/.test(amount)) return "لا يوجد متبقٍ";
  return amount.startsWith("-") ? "للعميل رصيد" : "على العميل";
}
export function absoluteAmount(amount: string): string { return amount.replace(/^-/, ""); }
export function accountTypeLabel(type: number): string {
  return type === 1 ? "على العميل" : type === 2 ? "للعميل رصيد" : "الحساب متعادل";
}
