export function parseIdentityId(raw: string | undefined): number {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 0;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : 0;
}
export function roleOptions<T extends { id: number; key: string; name: string; status: number }>(roles: T[]) {
  return roles.filter((role) => role.status === 1);
}
export function toFilterPage(raw: string | null): number {
  const value = Number(raw);
  return raw && Number.isInteger(value) && value > 0 && value < 1_000_000 ? value : 1;
}
