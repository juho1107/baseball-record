"use client";

import { useEffect, useMemo, useState } from "react";
import { combineStats, fromUniquePlay, type RecordStats, type UniquePlayRaw } from "./record-utils";

type Source = "combined" | "gameone" | "uniqueplay" | "yagoos" | "nicecatch";
type TeamRecord = { name: string; career: RecordStats; seasons: Array<{ season: number; stats: RecordStats }> };
type GameOneRecord = { stats: RecordStats; career?: RecordStats; seasons?: Array<{ season: number; stats: RecordStats }>; teams?: TeamRecord[] };
type GameOnePlayer = { name: string; teams: string[]; record: GameOneRecord };
type UniquePlayer = { name: string; seasonRecords?: Array<{ season: number; records: UniquePlayRaw }> };
type UniqueTeam = { name: string; players: UniquePlayer[] };
type YagoosPlayer = { name: string; seasonRecords?: Array<{ season: number; stats: RecordStats }> };
type YagoosTeam = { name: string; players: YagoosPlayer[] };
type NicecatchPlayer = { name: string; seasonRecords?: Array<{ season: number; stats: RecordStats }> };
type NicecatchTeam = { name: string; players: NicecatchPlayer[] };
type Person = { name: string; teams: string[]; sources: Set<Exclude<Source, "combined">> };

const clean = (value: string) => value.replace(/\s+/g, "").toLowerCase();
const SOURCE_LABEL: Record<Source, string> = { combined: "통합", gameone: "게임원", uniqueplay: "유니크플레이", yagoos: "야구스", nicecatch: "나이스캐치" };

export default function TeamDirectory() {
  const [gameone, setGameone] = useState<{ players: GameOnePlayer[] }>({ players: [] });
  const [unique, setUnique] = useState<{ teams: UniqueTeam[] }>({ teams: [] });
  const [yagoos, setYagoos] = useState<{ teams: YagoosTeam[] }>({ teams: [] });
  const [nicecatch, setNicecatch] = useState<{ teams: NicecatchTeam[] }>({ teams: [] });
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [team, setTeam] = useState("all");
  const [season, setSeason] = useState("career");
  const [source, setSource] = useState<Source>("combined");
  const [kind, setKind] = useState<"batting" | "pitching">("batting");

  useEffect(() => {
    Promise.all([
      fetch("/api/gameone/snapshot").then((response) => response.json()),
      fetch("/api/uniqueplay").then((response) => response.json()),
      fetch("/api/yagoos").then((response) => response.json()),
      fetch("/api/nicecatch").then((response) => response.json()),
    ]).then(([gameoneData, uniqueData, yagoosData, nicecatchData]) => {
      setGameone({ players: gameoneData.players ?? [] });
      setUnique({ teams: uniqueData.teams ?? [] });
      setYagoos({ teams: yagoosData.teams ?? [] });
      setNicecatch({ teams: nicecatchData.teams ?? [] });
    });
  }, []);

  const allPeople = useMemo(() => {
    const map = new Map<string, Person>();
    const add = (name: string, teamName: string, sourceName: Exclude<Source, "combined">) => {
      const key = clean(name);
      const person = map.get(key) ?? { name: name.trim(), teams: [], sources: new Set<Exclude<Source, "combined">>() };
      if (!person.teams.includes(teamName)) person.teams.push(teamName);
      person.sources.add(sourceName);
      map.set(key, person);
    };
    gameone.players.forEach((player) => player.teams.forEach((teamName) => add(player.name, teamName, "gameone")));
    unique.teams.forEach((teamData) => teamData.players.forEach((player) => add(player.name, teamData.name, "uniqueplay")));
    yagoos.teams.forEach((teamData) => teamData.players.forEach((player) => add(player.name, teamData.name, "yagoos")));
    nicecatch.teams.forEach((teamData) => teamData.players.forEach((player) => add(player.name, teamData.name, "nicecatch")));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [gameone, unique, yagoos, nicecatch]);

  const people = allPeople.filter((person) => clean(person.name).includes(clean(query)));
  const selected = allPeople.find((person) => person.name === selectedName) ?? null;
  const selectedGameOne = selected ? gameone.players.filter((player) => clean(player.name) === clean(selected.name)) : [];
  const selectedUnique = selected ? unique.teams.filter((teamData) => teamData.players.some((player) => clean(player.name) === clean(selected.name))) : [];
  const selectedYagoos = selected ? yagoos.teams.filter((teamData) => teamData.players.some((player) => clean(player.name) === clean(selected.name))) : [];
  const selectedNicecatch = selected ? nicecatch.teams.filter((teamData) => teamData.players.some((player) => clean(player.name) === clean(selected.name))) : [];

  const gameStats = selected ? combineStats(selectedGameOne.map((player) => {
    if (team === "all") return season === "career" ? (player.record.career ?? player.record.stats) : player.record.seasons?.find((item) => String(item.season) === season)?.stats;
    const selectedTeam = player.record.teams?.find((item) => item.name === team);
    return season === "career" ? selectedTeam?.career : selectedTeam?.seasons.find((item) => String(item.season) === season)?.stats;
  })) : undefined;

  const uniqueStats = selected ? combineStats(selectedUnique.filter((item) => team === "all" || item.name === team).flatMap((teamData) => {
    const records = teamData.players.find((player) => clean(player.name) === clean(selected.name))?.seasonRecords ?? [];
    return (season === "career" ? records : records.filter((item) => String(item.season) === season)).map((item) => fromUniquePlay(item.records));
  })) : undefined;

  const yagoosStats = selected ? combineStats(selectedYagoos.filter((item) => team === "all" || item.name === team).flatMap((teamData) => {
    const records = teamData.players.find((player) => clean(player.name) === clean(selected.name))?.seasonRecords ?? [];
    return (season === "career" ? records : records.filter((item) => String(item.season) === season)).map((item) => item.stats);
  })) : undefined;

  const nicecatchStats = selected ? combineStats(selectedNicecatch.filter((item) => team === "all" || item.name === team).flatMap((teamData) => {
    const records = teamData.players.find((player) => clean(player.name) === clean(selected.name))?.seasonRecords ?? [];
    return (season === "career" ? records : records.filter((item) => String(item.season) === season)).map((item) => item.stats);
  })) : undefined;

  const stats = source === "gameone" ? gameStats : source === "uniqueplay" ? uniqueStats : source === "yagoos" ? yagoosStats : source === "nicecatch" ? nicecatchStats : combineStats([gameStats, uniqueStats, yagoosStats, nicecatchStats]);
  const seasons = selected ? [...new Set([
    ...selectedGameOne.flatMap((player) => team === "all" ? player.record.seasons?.map((item) => item.season) ?? [] : player.record.teams?.filter((item) => item.name === team).flatMap((item) => item.seasons.map((record) => record.season)) ?? []),
    ...selectedUnique.filter((item) => team === "all" || item.name === team).flatMap((teamData) => teamData.players.find((player) => clean(player.name) === clean(selected.name))?.seasonRecords?.map((item) => item.season) ?? []),
    ...selectedYagoos.filter((item) => team === "all" || item.name === team).flatMap((teamData) => teamData.players.find((player) => clean(player.name) === clean(selected.name))?.seasonRecords?.map((item) => item.season) ?? []),
    ...selectedNicecatch.filter((item) => team === "all" || item.name === team).flatMap((teamData) => teamData.players.find((player) => clean(player.name) === clean(selected.name))?.seasonRecords?.map((item) => item.season) ?? []),
  ])].sort((a, b) => b - a) : [];

  function choose(person: Person) {
    setSelectedName(person.name); setTeam("all"); setSeason("career"); setSource("combined"); setKind("batting"); setListOpen(false);
  }

  return <section className="team-directory records" id="players">
    <div className="section-head"><div><span className="section-kicker">PLAYER DIRECTORY</span><h2>선수 기록 찾기</h2></div><div className="sync"><span /> 4개 서비스 통합<small>게임원 · 유니크플레이 · 야구스 · 나이스캐치</small></div></div>
    <div className="directory-filters"><input value={query} onChange={(event) => { const value = event.target.value; setQuery(value); setListOpen(Boolean(value.trim())); }} placeholder="선수 이름 검색" aria-label="선수 이름 검색" /><button type="button" className={listOpen ? "directory-list-toggle open" : "directory-list-toggle"} onClick={() => setListOpen((open) => !open)} aria-expanded={listOpen} aria-controls="directory-player-list"><span>선수 목록</span><small>{allPeople.length}명</small><b aria-hidden="true">⌄</b></button></div>
    {(listOpen || selected) && <div className={listOpen ? "directory-layout" : "directory-layout list-collapsed"}>
      {listOpen && <div className="directory-list" id="directory-player-list">{people.map((person, index) => <button key={person.name} className={selectedName === person.name ? "selected" : ""} onClick={() => choose(person)}><span className="directory-rank">{index + 1}</span><span className="directory-player"><b>{person.name}</b><small>{person.teams.join(" · ")}</small></span><span className="source-badges">{[...person.sources].map((item) => <i key={item}>{SOURCE_LABEL[item]}</i>)}</span></button>)}{!people.length && <p className="directory-empty">검색 결과가 없습니다.</p>}</div>}
      <div className={selected ? "directory-detail has-selection" : "directory-detail"}>{selected ? <>
        <button className="detail-close" onClick={() => setSelectedName("")} aria-label="선수 상세 닫기">×</button>
        <span className="detail-kicker">PLAYER RECORD</span><h3>{selected.name}</h3><p>{selected.teams.join(" · ")}</p>
        <div className="detail-controls"><select value={team} onChange={(event) => { setTeam(event.target.value); setSeason("career"); }}><option value="all">{selected.teams.length > 1 ? "전체 팀" : selected.teams[0]}</option>{selected.teams.length > 1 && selected.teams.map((name) => <option key={name}>{name}</option>)}</select><select value={season} onChange={(event) => setSeason(event.target.value)}><option value="career">통산</option>{seasons.map((year) => <option key={year}>{year}</option>)}</select></div>
        <div className="detail-switches"><div className="directory-toggle">{(["combined", "gameone", "uniqueplay", "yagoos", "nicecatch"] as Source[]).map((item) => <button key={item} className={source === item ? "active" : ""} onClick={() => setSource(item)}>{SOURCE_LABEL[item]}</button>)}</div><div className="directory-toggle"><button className={kind === "batting" ? "active" : ""} onClick={() => setKind("batting")}>타자</button><button className={kind === "pitching" ? "active" : ""} onClick={() => setKind("pitching")}>투수</button></div></div>
        {stats ? <PlayerStats stats={stats} kind={kind} /> : <p className="detail-no-record">선택한 조건에 기록이 없습니다.</p>}
      </> : <div className="detail-placeholder"><b>선수 이름을 선택하세요</b><span>소속 팀과 통산·연도별 기록을 한 화면에서 비교할 수 있습니다.</span></div>}</div>
    </div>}
  </section>;
}

function PlayerStats({ stats, kind }: { stats: RecordStats; kind: "batting" | "pitching" }) {
  const bat = stats.batting!; const pit = stats.pitching!;
  const divide = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
  const format = (value: number | null, digits = 3) => value == null || !Number.isFinite(value) ? "-" : value.toFixed(digits);
  const plateAppearances = bat.atBats + (bat.walks ?? 0) + (bat.hitByPitch ?? 0) + (bat.sacrificeFlies ?? 0);
  const obp = divide(bat.hits + (bat.walks ?? 0) + (bat.hitByPitch ?? 0), plateAppearances);
  const slg = divide(bat.totalBases ?? 0, bat.atBats);
  const pitchingOuts = pit.pitchingOuts ?? 0;
  const values: Array<[string, string | number]> = kind === "batting"
    ? [["경기", bat.games], ["타석", plateAppearances], ["타수", bat.atBats], ["안타", bat.hits], ["홈런", bat.homeRuns ?? 0], ["타점", bat.rbi], ["볼넷", bat.walks ?? 0], ["사구", bat.hitByPitch ?? 0], ["희생플라이", bat.sacrificeFlies ?? 0], ["총루타", bat.totalBases ?? 0], ["타율", format(bat.average)], ["출루율", format(obp)], ["장타율", format(slg)], ["OPS", format(bat.ops)], ["ISO", format(slg == null ? null : slg - bat.average)], ["경기당 안타", format(divide(bat.hits, bat.games), 2)], ["경기당 타점", format(divide(bat.rbi, bat.games), 2)], ["홈런당 타수", format(divide(bat.atBats, bat.homeRuns ?? 0), 1)]]
    : [["경기", pit.games], ["승", pit.wins ?? 0], ["패", pit.losses ?? 0], ["이닝", pit.innings], ["탈삼진", pit.strikeouts ?? 0], ["피안타", pit.hitsAllowed ?? 0], ["볼넷", pit.walks ?? 0], ["자책점", pit.earnedRuns ?? 0], ["방어율", format(pit.era, 2)], ["WHIP", format(pit.whip, 2)], ["승률", format(divide(pit.wins ?? 0, (pit.wins ?? 0) + (pit.losses ?? 0)))], ["경기당 이닝", format(divide(pitchingOuts / 3, pit.games), 2)], ["K/7", format(divide((pit.strikeouts ?? 0) * 21, pitchingOuts), 2)], ["BB/7", format(divide((pit.walks ?? 0) * 21, pitchingOuts), 2)], ["H/7", format(divide((pit.hitsAllowed ?? 0) * 21, pitchingOuts), 2)], ["K/BB", format(divide(pit.strikeouts ?? 0, pit.walks ?? 0), 2)]];
  return <div className="detail-stats">{values.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}
