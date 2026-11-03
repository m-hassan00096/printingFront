import { describe, expect, it } from "vitest";
import { formatLedgerRecordedAt } from "@/features/finance/lib/ledger-recorded-at";

describe("customer account ledger posting time", () => {
  it("converts UTC timestamps to Cairo local clock time in winter and summer", () => {
    expect(formatLedgerRecordedAt("2026-11-03T09:14:00Z")).toEqual({
      date: "03/11/2026", time: "11:14 ص",
    });
    expect(formatLedgerRecordedAt("2026-08-03T09:14:00Z")).toEqual({
      date: "03/08/2026", time: "12:14 م",
    });
  });

  it("respects the source offset and handles the date change across midnight", () => {
    expect(formatLedgerRecordedAt("2026-11-03T00:15:00+05:00")).toEqual({
      date: "02/11/2026", time: "9:15 م",
    });
    expect(formatLedgerRecordedAt("2026-10-26T10:00:00+03:00")).toEqual({
      date: "26/10/2026", time: "10:00 ص",
    });
  });

  it("displays 2:00 AM/PM and noon/midnight using Arabic clock markers", () => {
    expect(formatLedgerRecordedAt("2026-11-03T00:00:00+02:00")?.time).toBe("12:00 ص");
    expect(formatLedgerRecordedAt("2026-11-03T12:00:00+02:00")?.time).toBe("12:00 م");
    expect(formatLedgerRecordedAt("2026-11-03T02:00:00+02:00")?.time).toBe("2:00 ص");
    expect(formatLedgerRecordedAt("2026-11-03T14:00:00+02:00")?.time).toBe("2:00 م");
  });

  it("does not fabricate a posting hour for records without a valid timestamp", () => {
    expect(formatLedgerRecordedAt(null)).toBeNull();
    expect(formatLedgerRecordedAt(undefined)).toBeNull();
    expect(formatLedgerRecordedAt("2026-11-03")).toBeNull();
    expect(formatLedgerRecordedAt("2026-13-03T12:00:00Z")).toBeNull();
    expect(formatLedgerRecordedAt("not-a-timestamp")).toBeNull();
  });
});
