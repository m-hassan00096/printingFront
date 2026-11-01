import { describe, expect, it } from "vitest";
import { formatPriceForDisplay } from "@/features/printing-services/lib/format-price";

describe("catalog price display formatting", () => {
  it("shows standard amounts using two decimals", () => {
    expect(formatPriceForDisplay("10.000000")).toBe("10.00");
    expect(formatPriceForDisplay("10")).toBe("10.00");
    expect(formatPriceForDisplay("7.000000")).toBe("7.00");
    expect(formatPriceForDisplay("10.500000")).toBe("10.50");
  });

  it("preserves meaningful fractional area rates without rounding", () => {
    expect(formatPriceForDisplay("0.025000")).toBe("0.025");
    expect(formatPriceForDisplay("0.000001")).toBe("0.000001");
    expect(formatPriceForDisplay("1.230400")).toBe("1.2304");
  });

  it("preserves a zero amount and does not manipulate unexpected values", () => {
    expect(formatPriceForDisplay("0.000000")).toBe("0.00");
    expect(formatPriceForDisplay("—")).toBe("—");
  });
});
