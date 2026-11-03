import { describe, expect, it } from "vitest";
import { formatLedgerRecordedAt } from "@/features/finance/lib/ledger-recorded-at";

describe("customer account ledger posting time", () => {
  it("converts UTC timestamps to Cairo local clock time in winter and summer", () => {
    expect(formatLedgerRecordedAt("2026-11-03T09:14:00Z")).toEqual({
      date: "03/11/2026", time: "11:14",
    });
    expect(formatLedgerRecordedAt("2026-08-03T09:14:00Z")).toEqual({
      date: "03/08/2026", time: "12:14",
    });
  });

  it("respects the source offset and handles the date change across midnight", () => {
    expect(formatLedgerRecordedAt("2026-11-03T00:15:00+05:00")).toEqual({
      date: "02/11/2026", time: "21:15",
    });
    expect(formatLedgerRecordedAt("2026-10-26T10:00:00+03:00")).toEqual({
      date: "26/10/2026", time: "10:00",
    });
  });

  it("does not fabricate a posting hour for records without a valid timestamp", () => {
    expect(formatLedgerRecordedAt(null)).toBeNull();
    expect(formatLedgerRecordedAt(undefined)).toBeNull();
    expect(formatLedgerRecordedAt("2026-11-03")).toBeNull();
    expect(formatLedgerRecordedAt("2026-13-03T12:00:00Z")).toBeNull();
    expect(formatLedgerRecordedAt("not-a-timestamp")).toBeNull();
  });
});
