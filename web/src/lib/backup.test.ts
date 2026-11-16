import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../types";
import { csvCell, parseBackup, sanitizeSettings } from "./backup";

describe("csvCell", () => {
  it("수식으로 실행될 수 있는 글자 앞에 '를 붙인다", () => {
    expect(csvCell('=HYPERLINK("http://x","클릭")')).toBe(`"'=HYPERLINK(""http://x"",""클릭"")"`);
    expect(csvCell("+1+1")).toBe(`"'+1+1"`);
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  });

  it("평범한 글자와 음수 숫자는 그대로 둔다", () => {
    expect(csvCell("이에스티")).toBe(`"이에스티"`);
    expect(csvCell(-12021)).toBe(`"-12021"`);
  });
});

describe("sanitizeSettings", () => {
  it("모르는 항목은 버리고 범위를 벗어난 값은 기본값으로 바꾼다", () => {
    const s = sanitizeSettings({ taxRate: 99, sellFeeRate: "0.1", defaultSubFee: -5, evil: 1, myBrokers: ["KB증권", 3, "x".repeat(41)] });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, myBrokers: ["KB증권"] });
    expect("evil" in s).toBe(false);
  });

  it("올바른 값은 그대로 둔다", () => {
    const ok = { ...DEFAULT_SETTINGS, taxRate: 0.18, brokerSubFee: { 대신증권: 1500 }, feeFreeBrokers: ["KB증권"] };
    expect(sanitizeSettings(ok)).toEqual(ok);
  });
});

describe("parseBackup", () => {
  const file = (records: unknown[], settings?: unknown) => JSON.stringify({ version: 1, records, settings });

  it("정상 백업을 읽는다", () => {
    const b = parseBackup(file([{ id: "abc-1", ipoNo: 2332, broker: "대신증권", qty: 5, sellPrice: 15000 }]));
    expect(b.records).toEqual([{ id: "abc-1", ipoNo: 2332, broker: "대신증권", qty: 5, sellPrice: 15000 }]);
    expect(b.settings).toBeUndefined();
  });

  it("음수·소수 수량이나 음수 판매가는 거부한다", () => {
    expect(() => parseBackup(file([{ ipoNo: 1, broker: "KB증권", qty: -1 }]))).toThrow();
    expect(() => parseBackup(file([{ ipoNo: 1, broker: "KB증권", qty: 1.5 }]))).toThrow();
    expect(() => parseBackup(file([{ ipoNo: 1, broker: "KB증권", qty: 1, sellPrice: -3 }]))).toThrow();
  });

  it("경로 글자가 든 ID는 새 ID로 바꾼다", () => {
    const [r] = parseBackup(file([{ id: "../../users/other", ipoNo: 1, broker: "KB증권", qty: 1 }])).records;
    expect(r.id).not.toContain("/");
  });
});
