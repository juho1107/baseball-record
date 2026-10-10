"use client";

import { Activity, CalendarDays, ChevronDown, Shield, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { combineStats, fromUniquePlay, type RecordStats, type UniquePlayRaw } from "./record-utils";

type Source = "combined" | "gameone" | "uniqueplay" | "yagoos" | "nicecatch";
type Entry = { name: string; source: Exclude<Source, "combined">; season: number; stats: RecordStats };
type SourceTeam = { name: string; players?: Array<{ name: string; seasonRecords?: Array<{ season: number; stats?: RecordStats; records?: UniquePlayRaw }> }> };
type GameOnePlayer = { name: string; record?: { teams?: Array<{ name: string; seasons: Array<{ season: number; stats: RecordStats }> }> } };
type LatestGame = { team: string; source: string; gameDate: string; opponent: string; teamScore: number; opponentScore: number; result: string };

const SOURCES: Array<{ id: Source; label: string }> = [
  { id: "combined", label: "통합" }, { id: "gameone", label: "게임원" },
  { id: "uniqueplay", label: "유니크플레이" }, { id: "yagoos", label: "야구스" }, { id: "nicecatch", label: "나이스캐치" },
];
const clean = (value: string) => value.replace(/\s+/g, "").toLowerCase();
const number = (value: number | null | undefined, digits = 3) => value == null || !Number.isFinite(value) ? "-" : value.toFixed(digits);

export default function TeamRecords() {
  const [entries, setEntries] = useState<Record<string, Entry[]>>({ 썬볼: [], 레드포니즈: [] });
  const [latest, setLatest] = useState<LatestGame[]>([]);
  const [team, setTeam] = useState("썬볼");
  const [season, setSeason] = useState("career");
  const [source, setSource] = useState<Source>("combined");
  const [kind, setKind] = useState<"batting" | "pitching">("batting");
  const [batSort, setBatSort] = useState<"average" | "hits" | "homeRuns" | "rbi" | "ops">("average");
  const [pitSort, setPitSort] = useState<"era" | "wins" | "strikeouts" | "innings" | "whip">("era");

  useEffect(() => {
    Promise.all([
      fetch("/api/gameone/snapshot").then((response) => response.json()),
      fetch("/api/uniqueplay").then((response) => response.json()),
      fetch("/api/yagoos").then((response) => response.json()),
      fetch("/api/nicecatch").then((response) => response.json()),
      fetch("/api/sync-status").then((response) => response.json()),
    ]).then(([gameone, uniqueplay, yagoos, nicecatch, sync]) => {
      const next: Record<string, Entry[]> = { 썬볼: [], 레드포니즈: [] };
      const add = (teamName: string, name: string, sourceName: Entry["source"], year: number, stats?: RecordStats) => {
        if (next[teamName] && stats) next[teamName].push({ name: name.trim(), source: sourceName, season: year, stats });
      };
      (gameone.players ?? []).forEach((player: GameOnePlayer) => player.record?.teams?.forEach((item) => item.seasons.forEach((record) => add(item.name, player.name, "gameone", record.season, record.stats))));
      const collect = (teams: SourceTeam[] = [], sourceName: Entry["source"], unique = false) => teams.forEach((item) => item.players?.forEach((player) => player.seasonRecords?.forEach((record) => add(item.name, player.name, sourceName, record.season, unique ? fromUniquePlay(record.records) : record.stats))));
      collect(uniqueplay.teams, "uniqueplay", true); collect(yagoos.teams, "yagoos"); collect(nicecatch.teams, "nicecatch");
      setEntries(next); setLatest(sync.teams ?? []);
    });
  }, []);

  const teamEntries = entries[team] ?? [];
  const years = useMemo(() => [...new Set(teamEntries.map((entry) => entry.season))].sort((a, b) => b - a), [teamEntries]);
  const availableSources = useMemo(() => new Set(teamEntries.map((entry) => entry.source)), [teamEntries]);
  const players = useMemo(() => {
    const grouped = new Map<string, { name: string; values: RecordStats[]; sources: Set<string> }>();
    teamEntries.filter((entry) => (season === "career" || String(entry.season) === season) && (source === "combined" || entry.source === source)).forEach((entry) => {
      const key = clean(entry.name); const player = grouped.get(key) ?? { name: entry.name, values: [], sources: new Set<string>() };
      player.values.push(entry.stats); player.sources.add(entry.source); grouped.set(key, player);
    });
    return [...grouped.values()].map((player) => ({ ...player, stats: combineStats(player.values)! })).filter((player) => player.stats);
  }, [teamEntries, season, source]);
  const teamStats = combineStats(players.map((player) => player.stats));
  const qualificationEntries = teamEntries.filter((entry) => (season === "career" || String(entry.season) === season) && (source === "combined" || entry.source === source));
  const sourceSeasonGames = new Map<string, number>();
  qualificationEntries.forEach((entry) => {
    const key = `${entry.season}:${entry.source}`;
    sourceSeasonGames.set(key, Math.max(sourceSeasonGames.get(key) ?? 0, entry.stats.batting?.games ?? entry.stats.games ?? 0));
  });
  const seasonGames = new Map<number, number>();
  qualificationEntries.forEach((entry) => seasonGames.set(entry.season, Math.max(seasonGames.get(entry.season) ?? 0, sourceSeasonGames.get(`${entry.season}:${entry.source}`) ?? 0)));
  const estimatedGames = [...seasonGames.values()].reduce((sum, value) => sum + value, 0);
  const requiredPa = season === "career" ? 100 : Math.ceil(estimatedGames * 1.5);
  const requiredOuts = season === "career" ? 150 : estimatedGames * 3;
  const plateAppearances = (stats: RecordStats) => (stats.batting?.atBats ?? 0) + (stats.batting?.walks ?? 0) + (stats.batting?.hitByPitch ?? 0) + (stats.batting?.sacrificeFlies ?? 0);
  const isRateSort = kind === "batting" ? batSort === "average" || batSort === "ops" : pitSort === "era" || pitSort === "whip";
  const qualified = (stats: RecordStats) => kind === "batting" ? plateAppearances(stats) >= requiredPa : (stats.pitching?.pitchingOuts ?? 0) >= requiredOuts;
  const sortValue = (stats: RecordStats) => kind === "batting"
    ? batSort === "average" ? stats.batting?.average : batSort === "hits" ? stats.batting?.hits : batSort === "homeRuns" ? stats.batting?.homeRuns : batSort === "rbi" ? stats.batting?.rbi : stats.batting?.ops
    : pitSort === "era" ? stats.pitching?.era : pitSort === "wins" ? stats.pitching?.wins : pitSort === "strikeouts" ? stats.pitching?.strikeouts : pitSort === "innings" ? stats.pitching?.pitchingOuts : stats.pitching?.whip;
  const lowerIsBetter = kind === "pitching" && (pitSort === "era" || pitSort === "whip");
  const sorted = [...players].sort((a, b) => {
    if (isRateSort && qualified(a.stats) !== qualified(b.stats)) return qualified(a.stats) ? -1 : 1;
    const aValue = sortValue(a.stats); const bValue = sortValue(b.stats);
    if (aValue == null && bValue != null) return 1; if (aValue != null && bValue == null) return -1;
    const difference = Number(bValue ?? 0) - Number(aValue ?? 0);
    return lowerIsBetter ? -difference : difference;
  });
  const game = latest.find((item) => item.team === team);

  const changeTeam = (value: string) => { setTeam(value); setSeason("career"); setSource("combined"); };
  return <section className="team-records" id="teams">
    <div className="section-head"><div><span className="section-kicker">TEAM RECORDS</span><h2>팀별 기록</h2></div><div className="sync"><span /> 저장된 기록으로 계산<small>새로 수집하지 않고 스냅샷 사용</small></div></div>
    <div className="team-record-toolbar">
      <div className="team-pills"><button className={team === "썬볼" ? "active" : ""} onClick={() => changeTeam("썬볼")}>썬볼</button><button className={team === "레드포니즈" ? "active" : ""} onClick={() => changeTeam("레드포니즈")}>레드포니즈</button></div>
      <label><select value={season} onChange={(event) => setSeason(event.target.value)}><option value="career">통산</option>{years.map((year) => <option key={year}>{year}</option>)}</select><ChevronDown size={14} /></label>
      <label><select value={source} onChange={(event) => setSource(event.target.value as Source)}>{SOURCES.filter((item) => item.id === "combined" || availableSources.has(item.id as Entry["source"])).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={14} /></label>
    </div>

    <div className="team-summary-grid">
      <Summary icon={<Users />} label="기록 선수" value={players.length} suffix="명" />
      <Summary icon={<Activity />} label="팀 타율" value={number(teamStats?.batting?.average)} />
      <Summary icon={<Trophy />} label="팀 OPS" value={number(teamStats?.batting?.ops)} />
      <Summary icon={<Shield />} label="팀 방어율" value={number(teamStats?.pitching?.era, 2)} />
    </div>

    {game && <article className="team-latest-game"><div><span className="latest-label"><CalendarDays size={14} /> 최근 통합 경기</span><h3>{game.opponent}<small>{game.source}</small></h3></div><div className="latest-score"><strong>{game.teamScore}</strong><span className={`result-${game.result}`}>{game.result}</span><strong>{game.opponentScore}</strong></div><time>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(new Date(game.gameDate))}</time></article>}

    <div className="team-ranking-head"><div><h3>선수 기록 순위</h3><p>{source === "combined" ? "서비스별 기록을 합산한 값입니다." : `${SOURCES.find((item) => item.id === source)?.label} 기록입니다.`} · {kind === "batting" ? `규정 ${requiredPa}타석` : `규정 ${Math.floor(requiredOuts / 3)}이닝`}</p></div><div className="ranking-actions"><label><select value={kind === "batting" ? batSort : pitSort} onChange={(event) => kind === "batting" ? setBatSort(event.target.value as typeof batSort) : setPitSort(event.target.value as typeof pitSort)}>{kind === "batting" ? <><option value="average">타율순</option><option value="hits">안타순</option><option value="homeRuns">홈런순</option><option value="rbi">타점순</option><option value="ops">OPS순</option></> : <><option value="era">방어율순</option><option value="wins">승리순</option><option value="strikeouts">탈삼진순</option><option value="innings">이닝순</option><option value="whip">WHIP순</option></>}</select><ChevronDown size={13} /></label><div className="team-kind-toggle"><button className={kind === "batting" ? "active" : ""} onClick={() => setKind("batting")}>타자</button><button className={kind === "pitching" ? "active" : ""} onClick={() => setKind("pitching")}>투수</button></div></div></div>
    <p className="mobile-table-hint">선수 이름은 고정됩니다 · 기록은 좌우로 밀어서 확인하세요</p>
    <div className="team-ranking-table"><table><thead><tr><th>순위</th><th>선수</th>{kind === "batting" ? <><th>경기</th><th>타수</th><th>안타</th><th>홈런</th><th>타점</th><th>타율</th><th>OPS</th></> : <><th>경기</th><th>승</th><th>패</th><th>이닝</th><th>탈삼진</th><th>방어율</th><th>WHIP</th></>}</tr></thead><tbody>{sorted.map((player, index) => {
      const bat = player.stats.batting; const pit = player.stats.pitching;
      const meetsRule = qualified(player.stats); const rank = isRateSort && !meetsRule ? null : isRateSort ? sorted.slice(0, index + 1).filter((item) => qualified(item.stats)).length : index + 1;
      return <tr key={clean(player.name)} className={!meetsRule && isRateSort ? "unqualified" : ""}><td><span className={rank ? `rank top-${rank}` : "rank"}>{rank ?? "-"}</span></td><td><div className="team-player-name"><b>{player.name}{!meetsRule && isRateSort && <i>규정 미달</i>}</b><small>{[...player.sources].map((item) => SOURCES.find((sourceItem) => sourceItem.id === item)?.label).join(" · ")}</small></div></td>{kind === "batting" ? <><td>{bat?.games ?? 0}</td><td>{bat?.atBats ?? 0}</td><td>{bat?.hits ?? 0}</td><td>{bat?.homeRuns ?? 0}</td><td>{bat?.rbi ?? 0}</td><td>{number(bat?.average)}</td><td>{number(bat?.ops)}</td></> : <><td>{pit?.games ?? 0}</td><td>{pit?.wins ?? 0}</td><td>{pit?.losses ?? 0}</td><td>{pit?.innings ?? "0"}</td><td>{pit?.strikeouts ?? 0}</td><td>{number(pit?.era, 2)}</td><td>{number(pit?.whip, 2)}</td></>}</tr>;
    })}</tbody></table>{!sorted.length && <p className="directory-empty">선택한 조건의 기록이 없습니다.</p>}</div>
    {source === "combined" && <p className="team-record-note">통합 탭은 현재 서비스별 누적 기록을 합산합니다. 동일 경기가 여러 서비스에 등록된 경우의 경기 단위 중복 제거는 전체 경기 목록 수집 후 적용됩니다.</p>}
  </section>;
}

function Summary({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string | number; suffix?: string }) {
  return <article className="team-summary"><span>{icon}</span><div><small>{label}</small><strong>{value}{suffix && <em>{suffix}</em>}</strong></div></article>;
}
