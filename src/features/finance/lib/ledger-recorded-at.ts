/**
 * Posting time is distinct from effectiveDate (the accounting date).
 * The backend returns createdAt as an ISO-8601 timestamp with an offset.
 * Never manufacture a time for older records that have no timestamp.
 */
export function formatLedgerRecordedAt(value: string | null | undefined): {date: string; time: string} | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    return null;

  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;

  const pieces = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => pieces.find(piece => piece.type === type)?.value;
  const day = get("day"), month = get("month"), year = get("year");
  const hour = get("hour"), minute = get("minute");
  if (!day || !month || !year || !hour || !minute) return null;
  return {date: day + "/" + month + "/" + year, time: hour + ":" + minute};
}
