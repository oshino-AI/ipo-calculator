import { describe, expect, it } from "vitest";
import { openGapRate, signedPct } from "./format";

describe("openGapRate", () => {
  it("공모가 대비 시초가 등락률을 구한다", () => {
    expect(openGapRate({ price: 11000, open: 16170 })).toBeCloseTo(47, 5);
    expect(signedPct(openGapRate({ price: 8000, open: 7620 })!)).toBe("−4.75%");
  });

  it("공모가나 시초가가 없으면 null", () => {
    expect(openGapRate({ price: 11000 })).toBeNull();
    expect(openGapRate({ open: 16170 })).toBeNull();
  });
});
