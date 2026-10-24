"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const descriptions: Record<string, string> = {
  games: "선택한 팀·연도·출처에서 타자 또는 투수로 출전한 경기 수입니다.",
  plateAppearances: "이 앱에서는 타수 + 볼넷 + 사구 + 희생플라이로 계산합니다. 희생번트 등은 제외되어 원본 사이트의 공식 타석 수와 다를 수 있습니다.",
  atBats: "타격 기회 중 볼넷·사구·희생타 등을 제외한 타수입니다.",
  hits: "단타·2루타·3루타·홈런을 모두 합친 안타 수입니다.",
  homeRuns: "홈런을 기록한 횟수입니다.",
  rbi: "타격 결과로 주자가 득점해 타자에게 인정된 타점입니다.",
  walks: "볼넷으로 출루한 횟수입니다.",
  hitByPitch: "투구에 몸을 맞아 출루한 횟수입니다.",
  sacrificeFlies: "희생플라이로 기록된 횟수입니다.",
  totalBases: "안타로 얻은 루타 수입니다. 단타 + 2루타×2 + 3루타×3 + 홈런×4로 계산합니다. 도루는 포함하지 않습니다.",
  strikeouts: "타자가 삼진으로 아웃된 횟수입니다.",
  stolenBases: "주자가 도루에 성공한 횟수입니다. 도루 실패는 포함하지 않습니다.",
  average: "타율 = 안타 ÷ 타수. 타수 중 안타를 친 비율입니다.",
  obp: "출루율 = (안타 + 볼넷 + 사구) ÷ (타수 + 볼넷 + 사구 + 희생플라이). 실책 출루는 포함하지 않습니다.",
  slg: "장타율 = 총루타 ÷ 타수. 한 타수에서 평균적으로 얻는 루타 수입니다.",
  ops: "OPS = 출루율 + 장타율. 출루 능력과 장타력을 함께 보는 지표입니다.",
  iso: "ISO(순수 장타율) = 장타율 − 타율. 단타를 제외한 장타력을 나타냅니다. 타율 0.300, 장타율 0.500이면 ISO는 0.200입니다.",
  hitsPerGame: "경기당 안타 = 안타 ÷ 타자 출전 경기 수입니다.",
  rbiPerGame: "경기당 타점 = 타점 ÷ 타자 출전 경기 수입니다.",
  atBatsPerHomeRun: "홈런당 타수 = 타수 ÷ 홈런. 홈런 하나를 기록하는 데 필요한 평균 타수로, 낮을수록 홈런 빈도가 높습니다. 홈런이 없으면 계산하지 않습니다.",
  wins: "투수에게 승리투수로 기록된 횟수입니다.",
  losses: "투수에게 패전투수로 기록된 횟수입니다.",
  innings: "투구 이닝입니다. 5.1은 5이닝과 아웃 1개, 5.2는 5이닝과 아웃 2개를 뜻합니다. 소수점 비율이 아닙니다.",
  hitsAllowed: "투수가 허용한 안타 수입니다.",
  earnedRuns: "투수의 책임으로 인정된 실점(자책점)입니다.",
  era: "방어율 = 자책점 × 7 ÷ 투구 이닝. 이 앱은 사회인야구에 맞춰 7이닝 기준으로 계산하며 낮을수록 좋습니다.",
  whip: "WHIP = (피안타 + 볼넷) ÷ 투구 이닝. 이닝당 허용한 안타·볼넷 수이며 사구는 제외합니다.",
  winPct: "승률 = 승 ÷ (승 + 패). 승패가 기록되지 않은 등판은 분모에서 제외합니다.",
  inningsPerGame: "경기당 이닝 = 투구 이닝 ÷ 투수 출전 경기 수입니다.",
  k7: "K/7 = 탈삼진 × 7 ÷ 투구 이닝. 7이닝당 평균 탈삼진 수입니다.",
  bb7: "BB/7 = 볼넷 × 7 ÷ 투구 이닝. 7이닝당 평균 허용 볼넷 수입니다.",
  h7: "H/7 = 피안타 × 7 ÷ 투구 이닝. 7이닝당 평균 피안타 수입니다.",
  kbb: "K/BB = 탈삼진 ÷ 볼넷. 볼넷 하나당 잡은 삼진 수이며, 볼넷이 0이면 계산하지 않습니다.",
};

export default function StatHelp({ stat, label, kind }: { stat: string; label: string; kind: "batting" | "pitching" }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const description = kind === "pitching" && stat === "strikeouts" ? "투수가 타자를 삼진으로 아웃시킨 횟수입니다." : kind === "pitching" && stat === "walks" ? "투수가 허용한 볼넷 수입니다." : descriptions[stat];
  function close() { clearTimeout(timer.current); pinned.current = false; setPosition(null); }
  function show() {
    clearTimeout(timer.current);
    const rect = button.current?.getBoundingClientRect();
    if (rect) setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - Math.min(320, window.innerWidth - 24) - 12)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 210)) });
  }
  function leave() { if (!pinned.current) timer.current = setTimeout(close, 160); }
  useEffect(() => {
    if (!position) return;
    const outside = (event: PointerEvent) => { if (!button.current?.contains(event.target as Node) && !bubble.current?.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    const scroll = (event: Event) => { if (!bubble.current?.contains(event.target as Node)) close(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); window.removeEventListener("scroll", scroll, true); window.removeEventListener("resize", close); clearTimeout(timer.current); };
  }, [position]);
  return <><button ref={button} type="button" className="stat-help-trigger" aria-label={`${label} 설명`} aria-describedby={position ? id : undefined}
    onPointerEnter={(event) => { if (event.pointerType === "mouse") show(); }} onPointerLeave={leave} onFocus={show} onBlur={leave}
    onClick={() => { if (pinned.current) close(); else { pinned.current = true; show(); } }}>{label}<span aria-hidden="true">ⓘ</span></button>
    {position && createPortal(<div ref={bubble} id={id} role="tooltip" className="stat-help-bubble" style={position} onPointerEnter={() => clearTimeout(timer.current)} onPointerLeave={leave}><strong>{label}</strong><p>{description ?? `${label} 기록입니다.`}</p></div>, document.body)}</>;
}
