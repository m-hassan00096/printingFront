import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMobileListLayout } from "@/shared/hooks/use-mobile-list-layout";

const original = window.innerWidth;
afterEach(() => {
  window.innerWidth = original;
  act(() => window.dispatchEvent(new Event("resize")));
});

describe("mobile list layout", () => {
  it("switches between stacked cards and tables when viewport changes", () => {
    window.innerWidth = 390;
    const view = renderHook(() => useMobileListLayout());
    expect(view.result.current).toBe(true);

    act(() => {
      window.innerWidth = 900;
      window.dispatchEvent(new Event("resize"));
    });
    expect(view.result.current).toBe(false);

    act(() => {
      window.innerWidth = 320;
      window.dispatchEvent(new Event("resize"));
    });
    expect(view.result.current).toBe(true);
    view.unmount();
  });
});
