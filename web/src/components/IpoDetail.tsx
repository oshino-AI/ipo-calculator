import { useEffect, useId, useRef, useState } from "react";
import { minDeposit } from "../lib/calc";
import { dateRange, fullDate, openGapRate, shortBroker, signedPct, todayIso, won } from "../lib/format";
import { useStore } from "../lib/store";
import type { Ipo } from "../types";
import { Sheet } from "./Sheet";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function priceText(ipo: Ipo): string {
  if (ipo.price) return won(ipo.price);
  if (ipo.bandLow && ipo.bandHigh) return `${ipo.bandLow.toLocaleString("ko-KR")} ~ ${won(ipo.bandHigh)} (희망)`;
  return "미정";
}

function openText(ipo: Ipo): string {
  const rate = openGapRate(ipo);
  if (!ipo.open) return "미정";
  return rate === null ? won(ipo.open) : `${won(ipo.open)} (공모가 대비 ${signedPct(rate)})`;
}

/** 시트 안쪽 여백. 창을 내용 폭(기존 회색 상자와 같은 폭)에 맞추는 데 쓴다. */
const SHEET_INSET = 20;

/**
 * 팝오버 창을 시트 제목 줄 바로 아래, 시트 내용 폭으로 놓는다.
 * 제목 줄은 스크롤되지 않으므로 열릴 때와 화면 크기가 바뀔 때만 다시 재면 된다.
 */
function placeBelowHead(pop: HTMLElement) {
  const head = pop.closest(".sheet")?.querySelector(".sheet-head");
  if (!head) return;
  const rect = head.getBoundingClientRect();
  pop.style.top = `${rect.bottom}px`;
  pop.style.left = `${rect.left + SHEET_INSET}px`;
  pop.style.width = `${rect.width - SHEET_INSET * 2}px`;
  pop.style.maxHeight = `${window.innerHeight - rect.bottom - 16}px`;
}

function floatText(ipo: Ipo): string {
  if (!ipo.floatShares) return "확인 불가";
  return `${ipo.floatShares.toLocaleString("ko-KR")}주 (${ipo.floatPct}%)`;
}

export function IpoDetail({ ipoNo, onClose, onToast }: { ipoNo: number; onClose: () => void; onToast: (m: string) => void }) {
  const { ipoByNo, settings, records, addRecord } = useStore();
  const [detailOpen, setDetailOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const popId = useId();
  const popRef = useRef<HTMLDivElement>(null);

  // 창이 열려 있는 동안 화면 크기가 바뀌면 다시 맞춘다.
  useEffect(() => {
    if (!detailOpen) return;
    const onResize = () => popRef.current && placeBelowHead(popRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [detailOpen]);

  const ipo = ipoByNo.get(ipoNo);
  if (!ipo) return null;

  const underwriters = [...(ipo.underwriters ?? [])].sort(
    (a, b) => Number(settings.myBrokers.includes(b.name)) - Number(settings.myBrokers.includes(a.name)),
  );
  const taken = new Set(records.filter((r) => r.ipoNo === ipoNo).map((r) => r.broker));

  const subscribe = (broker: string) => {
    addRecord(ipoNo, broker);
    onToast(`${ipo.name}을(를) 내 청약에 추가했어요`);
    onClose();
  };
  const onlyBroker = underwriters.length === 1 ? underwriters[0].name : null;
  const alreadyDone = onlyBroker !== null && taken.has(onlyBroker);

  const toggle = (
    <button className="pill" popoverTarget={popId}>
      {detailOpen ? "접기" : "자세히"}
    </button>
  );

  return (
    <Sheet title={ipo.name} aside={toggle} onClose={onClose}>
      {/* 자세한 정보는 기존 내용을 밀지 않도록 제목 줄 아래에 떠 있는 창(팝오버)으로 띄운다. */}
      <div
        id={popId}
        ref={popRef}
        popover="auto"
        className="detail-pop"
        onBeforeToggle={(e) => e.newState === "open" && placeBelowHead(e.currentTarget)}
        onToggle={(e) => setDetailOpen(e.newState === "open")}
      >
        <dl className="info">
          <Row label="기관 경쟁률" value={ipo.instCompetition ?? "미정"} />
          <Row label="청약 경쟁률" value={ipo.subCompetition ?? "미정"} />
          <Row label="비례 경쟁률" value={ipo.proportional ?? "미정"} />
          <Row label="의무보유 확약" value={ipo.lockupPct != null ? `${ipo.lockupPct}%` : "미정"} />
          <Row label="유통가능 주식" value={floatText(ipo)} />
          <Row label="업종" value={ipo.industry ?? "확인 불가"} />
        </dl>
      </div>
      <dl className="info">
        <Row label="공모가" value={priceText(ipo)} />
        <Row label="공모 일정" value={dateRange(ipo.subStart, ipo.subEnd)} />
        <Row label="배정·환불" value={fullDate(ipo.refundDate ?? ipo.allocDate) || "미정"} />
        <Row label="상장일" value={fullDate(ipo.listDate) || "미정"} />
        {ipo.listDate && ipo.listDate <= todayIso() && <Row label="시초가" value={openText(ipo)} />}
      </dl>

      <h3 className="section-title">증권사별 최소 청약증거금</h3>
      {underwriters.length === 0 && <p className="hint">주간사 정보가 아직 없어요.</p>}
      <ul className="deposit-list">
        {underwriters.map((u) => {
          const deposit = minDeposit(ipo, u.name, settings);
          const mine = settings.myBrokers.includes(u.name);
          return (
            <li key={u.name}>
              <span className={mine ? "strong" : ""}>
                {shortBroker(u.name)}
                {mine && <em className="tag">내 증권사</em>}
              </span>
              <span className="num">
                {deposit ? won(deposit.amount) : "미정"}
                {deposit && (
                  <small>
                    {deposit.qty}주 기준{deposit.estimated ? " · 예상" : ""}
                  </small>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {picking ? (
        <>
          <h3 className="section-title">어느 증권사로 청약하셨나요?</h3>
          {/* 증권사 수만큼 한 줄을 나눈다. 너무 좁아지지 않게 한 줄에 최대 4개까지 둔다. */}
          <div className="picker" style={{ gridTemplateColumns: `repeat(${Math.min(underwriters.length, 4)}, 1fr)` }}>
            {underwriters.map((u) => (
              <button
                key={u.name}
                className="btn picker-btn"
                disabled={taken.has(u.name)}
                onClick={() => subscribe(u.name)}
              >
                <span>{shortBroker(u.name)}</span>
                {taken.has(u.name) && <small>청약함</small>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          className="btn primary wide"
          disabled={underwriters.length === 0 || alreadyDone}
          onClick={() => (onlyBroker ? subscribe(onlyBroker) : setPicking(true))}
        >
          {alreadyDone ? "청약함" : "청약하기"}
        </button>
      )}
    </Sheet>
  );
}
