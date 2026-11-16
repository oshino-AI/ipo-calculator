import { DEFAULT_SETTINGS, type Settings, type SubRecord } from "../types";

export interface Backup {
  version: 1;
  settings?: Settings;
  records: SubRecord[];
}

// firestore.rules의 상한과 맞춘다. 규칙을 바꾸면 여기도 함께 바꾼다.
export const LIMITS = {
  brokerName: 40,
  brokers: 30,
  ipoNo: 10_000_000,
  qty: 1_000_000,
  price: 100_000_000,
  ratePct: 10,
  subFee: 100_000,
  minQty: 1_000_000,
  recordId: 64,
} as const;

const isInt = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
const isNum = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
const isBroker = (v: unknown): v is string => typeof v === "string" && v.trim() !== "" && v.length <= LIMITS.brokerName;

function brokerList(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  return [...new Set(v.filter(isBroker))].slice(0, LIMITS.brokers);
}

function brokerMap(v: unknown, max: number): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const entries = Object.entries(v).filter(([k, n]) => isBroker(k) && isNum(n, max));
  return Object.fromEntries(entries.slice(0, LIMITS.brokers));
}

/** 알 수 없는 항목은 버리고, 종류나 범위가 맞지 않는 값은 기본값으로 바꾼다. */
export function sanitizeSettings(raw: unknown): Settings {
  const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  return {
    myBrokers: brokerList(s.myBrokers, d.myBrokers),
    feeFreeBrokers: brokerList(s.feeFreeBrokers, d.feeFreeBrokers),
    taxRate: isNum(s.taxRate, LIMITS.ratePct) ? s.taxRate : d.taxRate,
    sellFeeRate: isNum(s.sellFeeRate, LIMITS.ratePct) ? s.sellFeeRate : d.sellFeeRate,
    defaultSubFee: isNum(s.defaultSubFee, LIMITS.subFee) ? s.defaultSubFee : d.defaultSubFee,
    brokerSubFee: brokerMap(s.brokerSubFee, LIMITS.subFee),
    defaultMinQty: isNum(s.defaultMinQty, LIMITS.minQty) ? s.defaultMinQty : d.defaultMinQty,
    brokerMinQty: brokerMap(s.brokerMinQty, LIMITS.minQty),
  };
}

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

function parseRecord(raw: unknown): SubRecord {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!isInt(r.ipoNo, LIMITS.ipoNo) || !isBroker(r.broker) || !isInt(r.qty, LIMITS.qty)) {
    throw new Error("형식이 맞지 않는 기록이 있어요");
  }
  const sell = r.sellPrice;
  if (sell !== undefined && sell !== null && !isNum(sell, LIMITS.price)) {
    throw new Error("판매가가 잘못된 기록이 있어요");
  }
  // 기록 ID는 서버 문서 이름이 되므로 '/' 같은 글자가 들어간 ID는 새로 만든다.
  const id = typeof r.id === "string" && r.id.length <= LIMITS.recordId && SAFE_ID.test(r.id) ? r.id : crypto.randomUUID();
  return { id, ipoNo: r.ipoNo, broker: r.broker, qty: r.qty, sellPrice: typeof sell === "number" ? sell : null };
}

export function parseBackup(text: string): Backup {
  const raw = JSON.parse(text);
  if (!raw || !Array.isArray(raw.records)) throw new Error("기록이 없는 파일이에요");
  return {
    version: 1,
    records: raw.records.map(parseRecord),
    settings: raw.settings ? sanitizeSettings(raw.settings) : undefined,
  };
}

/**
 * CSV 한 칸. 엑셀이 =, +, -, @ 로 시작하는 글자를 수식으로 실행하지 않도록 글자 칸 앞에 '를 붙인다.
 * 숫자는 음수(-1200)도 숫자 그대로 둔다.
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
