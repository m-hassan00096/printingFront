import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoneyAmount } from "@/shared/components/money-amount";
import { formatEgp } from "@/shared/lib/format-egp";

describe("EGP display formatting", () => {
  it("uses one consistent EGP position, separators and two decimal places", () => {
    expect(formatEgp("1000")).toBe("1,000.00 ج.م");
    expect(formatEgp(500)).toBe("500.00 ج.م");
    expect(formatEgp("20.0000", 4)).toBe("20.00 ج.م");
    expect(formatEgp("20.1250", 4)).toBe("20.125 ج.م");
  });

  it("isolates the currency from RTL surrounding text", () => {
    render(<p>الإجمالي <MoneyAmount amount="1200.50" /></p>);
    const amount = screen.getByText("1,200.50 ج.م");
    expect(amount.getAttribute("dir")).toBe("ltr");
    expect(amount.className).toContain("tabular-nums");
    expect(amount.className).toContain("whitespace-nowrap");
  });

  it("falls back safely for malformed display values", () => {
    expect(formatEgp("not-an-amount")).toBe("—");
  });
});
