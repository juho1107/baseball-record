"use client";

import { CalendarDays, CircleDot, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type TeamSync = {
  team: string;
  source: string;
  gameDate: string;
  opponent: string;
  teamScore: number;
  opponentScore: number;
  result: "승" | "패" | "무";
  syncedAt: string | null;
  comparedSources?: string[];
};

const date = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric",
}).format(new Date(value));

const dateTime = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
}).format(new Date(value));

export default function SyncOverview() {
  const [teams, setTeams] = useState<TeamSync[]>([]);

  useEffect(() => {
    fetch("/api/sync-status").then((response) => response.json()).then((body) => setTeams(body.teams ?? [])).catch(() => setTeams([]));
  }, []);

  if (!teams.length) return null;

  return <section className="sync-overview" aria-labelledby="sync-title">
    <div className="sync-overview-head">
      <div><span className="section-kicker">RECENT SYNC</span><h2 id="sync-title">최근 동기화</h2></div>
      <p><RefreshCw size={13} /> 저장된 기록 기준</p>
    </div>
    <div className="sync-team-grid">
      {teams.map((team) => <article className="sync-team-card" key={team.team}>
        <div className="sync-team-title"><span><CircleDot size={17} /></span><div><h3>{team.team}</h3><small>{team.source}</small></div></div>
        <div className="sync-game-date"><CalendarDays size={14} /><span>마지막 경기</span><b>{date(team.gameDate)}</b></div>
        <div className="sync-score"><strong>{team.teamScore}</strong><span><i className={`result-${team.result}`}>{team.result}</i><small>vs {team.opponent}</small></span><strong>{team.opponentScore}</strong></div>
        <div className="sync-card-foot"><span className="live-dot" />수집된 {team.comparedSources?.length ?? 1}개 출처 중 최신<time>{team.syncedAt ? `${dateTime(team.syncedAt)} 갱신` : "갱신 시각 없음"}</time></div>
      </article>)}
    </div>
  </section>;
}
