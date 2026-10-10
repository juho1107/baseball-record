"use client";

import { useEffect, useMemo, useState } from "react";
import { combineStats, fromUniquePlay, type RecordStats, type UniquePlayRaw } from "./record-utils";

type TeamRecord = { clubId: string; name: string; career: RecordStats; seasons: Array<{ season: number; stats: RecordStats }> };
type Profile = { name: string; record?: { fetchedAt: string; stats: RecordStats; career?: RecordStats; seasons?: Array<{ season: number; stats: RecordStats }>; teams?: TeamRecord[] } };
type UniquePlayer = { name: string; seasonRecords?: Array<{ season: number; records: UniquePlayRaw }> };
type UniqueTeam = { id: number; name: string; players: UniquePlayer[] };
type UniqueSnapshot = { connected: boolean; fetchedAt?: string; due?: boolean; teams?: UniqueTeam[] };
type GameOnePlayer = { name: string; teams: string[]; record: NonNullable<Profile["record"]> };
type GameOneSnapshot = { connected: boolean; fetchedAt?: string; due?: boolean; players?: GameOnePlayer[] };
type Source = "combined" | "gameone" | "uniqueplay";
const cleanName = (value: string) => value.replace(/\s+/g, "").toLowerCase();

export default function UnifiedRecord({ profile }: { profile: Profile }) {
  const [unique, setUnique] = useState<UniqueSnapshot | null>(null);
  const [gameone, setGameone] = useState<GameOneSnapshot | null>(null);
  const [source, setSource] = useState<Source>("combined");
  const [teamName, setTeamName] = useState("all");
  const [period, setPeriod] = useState("career");
  const [recordType, setRecordType] = useState<"batting" | "pitching">("batting");
  useEffect(() => {
    fetch("/api/uniqueplay").then((response) => response.json()).then(setUnique).catch(() => setUnique({ connected: false }));
    fetch("/api/gameone/snapshot").then((response) => response.json()).then(setGameone).catch(() => setGameone({ connected: false }));
  }, []);

  const playerName = cleanName(profile.name);
  const centralPlayers = gameone?.players?.filter((player) => cleanName(player.name) === playerName) ?? [];
  const gameoneRecords = centralPlayers.length ? centralPlayers.map((player) => player.record) : profile.record ? [profile.record] : [];
  const uniqueTeams = (unique?.teams ?? []).filter((team) => team.players.some((player) => cleanName(player.name) === playerName));
  const gameoneTeams = gameoneRecords.flatMap((record) => record.teams ?? []);
  const teamNames = [...new Set([...centralPlayers.flatMap((player) => player.teams), ...gameoneTeams.map((team) => team.name), ...uniqueTeams.map((team) => team.name)])];
  const membershipLabel = teamNames.length ? teamNames.join(" · ") : "소속팀 없음";
  const gameoneStats = useMemo(() => {
    const values = gameoneRecords.map((record) => {
      if (teamName === "all") return period === "career" ? (record.career ?? record.stats) : record.seasons?.find((item) => String(item.season) === period)?.stats;
      const team = record.teams?.find((item) => item.name === teamName);
      return period === "career" ? team?.career : team?.seasons.find((item) => String(item.season) === period)?.stats;
    });
    return combineStats(values);
  }, [gameoneRecords, teamName, period]);
  const uniqueStats = useMemo(() => {
    const values = uniqueTeams.filter((team) => teamName === "all" || team.name === teamName).flatMap((team) => {
      const seasons = team.players.find((item) => cleanName(item.name) === playerName)?.seasonRecords ?? [];
      return (period === "career" ? seasons : seasons.filter((item) => String(item.season) === period)).map((item) => fromUniquePlay(item.records));
    });
    return combineStats(values);
  }, [unique, teamName, period, playerName]);
  const stats = source === "gameone" ? gameoneStats : source === "uniqueplay" ? uniqueStats : combineStats([gameoneStats, uniqueStats]);
  const seasons = [...new Set([
    ...gameoneRecords.flatMap((record) => teamName === "all" ? record.seasons ?? [] : record.teams?.filter((team) => team.name === teamName).flatMap((team) => team.seasons) ?? []).map((item) => item.season),
    ...uniqueTeams.filter((team) => teamName === "all" || team.name === teamName).flatMap((team) => team.players.find((player) => cleanName(player.name) === playerName)?.seasonRecords?.map((item) => item.season) ?? []),
  ])].sort((a, b) => b - a);

  if (!stats) return <section className="my-record"><p className="unified-empty">선택한 조건에 기록이 없습니다.</p></section>;
  const batting = stats.batting ?? { games: stats.games, atBats: 0, average: stats.average, hits: stats.hits, homeRuns: stats.homeRuns, rbi: stats.rbi, ops: stats.ops };
  const pitching = stats.pitching ?? { games: 0, era: null, wins: null, losses: null, innings: "0", strikeouts: null, whip: null };
  const sourceLabel = source === "combined" ? "통합 기록" : source === "gameone" ? "게임원" : "유니크플레이";
  return <section className="my-record">
    <div className="my-record-heading"><div><span className="connected-dot" /> UNIFIED PLAYER RECORD<h2>{profile.name} <small>{teamName === "all" ? membershipLabel : teamName}</small></h2></div><div className="my-record-actions"><select value={teamName} onChange={(event) => { setTeamName(event.target.value); setPeriod("career"); }}><option value="all">{teamNames.length > 1 ? "전체 팀" : membershipLabel}</option>{teamNames.length > 1 && teamNames.map((team) => <option key={team}>{team}</option>)}</select><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="career">통산</option>{seasons.map((season) => <option key={season}>{season}</option>)}</select><a href="/connect">기록 동기화</a></div></div>
    <div className="source-tabs"><button className={source === "combined" ? "active" : ""} onClick={() => setSource("combined")}>통합</button><button className={source === "gameone" ? "active" : ""} onClick={() => setSource("gameone")}>게임원</button><button className={source === "uniqueplay" ? "active" : ""} onClick={() => setSource("uniqueplay")}>유니크플레이</button></div>
    <div className="record-type-tabs compact"><button className={recordType === "batting" ? "active" : ""} onClick={() => setRecordType("batting")}>타자</button><button className={recordType === "pitching" ? "active" : ""} onClick={() => setRecordType("pitching")}>투수 <small>{pitching.games}</small></button></div>
    {recordType === "batting" ? <div className="my-record-stats"><Stat label="경기" value={batting.games} /><Stat label="타수" value={batting.atBats} /><Stat label="타율" value={batting.average.toFixed(3)} /><Stat label="안타" value={batting.hits} /><Stat label="홈런" value={batting.homeRuns ?? "—"} /><Stat label="타점" value={batting.rbi} /><Stat label="OPS" value={batting.ops == null ? "—" : batting.ops.toFixed(3)} /></div> : <div className="my-record-stats"><Stat label="경기" value={pitching.games} /><Stat label="방어율" value={pitching.era?.toFixed(2) ?? "—"} /><Stat label="승" value={pitching.wins ?? "—"} /><Stat label="패" value={pitching.losses ?? "—"} /><Stat label="이닝" value={pitching.innings} /><Stat label="탈삼진" value={pitching.strikeouts ?? "—"} /><Stat label="WHIP" value={pitching.whip?.toFixed(2) ?? "—"} /></div>}
    <small className="my-record-time">{sourceLabel} · {period === "career" ? "통산" : `${period} 시즌`}{gameone?.fetchedAt || gameoneRecords[0]?.fetchedAt ? ` · 게임원 ${new Date(gameone?.fetchedAt ?? gameoneRecords[0].fetchedAt).toLocaleString("ko-KR")}` : " · 게임원 기록 없음"}{unique?.fetchedAt ? ` · 유니크플레이 ${new Date(unique.fetchedAt).toLocaleString("ko-KR")}` : " · 유니크플레이 미연결"}</small>
  </section>;
}

function Stat({ label, value }: { label: string; value: string | number }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
