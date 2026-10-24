"use client";

import { Activity, ArrowDown, ArrowUp, CalendarDays, ChevronDown, Download, ListFilter, Shield, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { combineStats, fromUniquePlay, canonicalPlayerName, playerKey, type RecordStats, type UniquePlayRaw } from "./record-utils";

type Source = "combined" | "gameone" | "uniqueplay" | "yagoos" | "nicecatch";
type Entry = { name: string; source: Exclude<Source, "combined">; season: number; stats: RecordStats };
type SourceTeam = { name: string; players?: Array<{ name: string; seasonRecords?: Array<{ season: number; stats?: RecordStats; records?: UniquePlayRaw }> }> };
type GameOnePlayer = { name: string; record?: { teams?: Array<{ name: string; seasons: Array<{ season: number; stats: RecordStats }> }> } };
type LatestGame = { team: string; source: string; gameDate: string; opponent: string; teamScore: number; opponentScore: number; result: string };

const SOURCES: Array<{ id: Source; label: string }> = [
  { id: "combined", label: "통합" }, { id: "gameone", label: "게임원" },
  { id: "uniqueplay", label: "유니크플레이" }, { id: "yagoos", label: "야구스" }, { id: "nicecatch", label: "나이스캐치" },
];
const clean = playerKey;
const number = (value: number | null | undefined, digits = 3) => value == null || !Number.isFinite(value) ? "-" : value.toFixed(digits);
type StatColumn = { id: string; label: string; value: (stats: RecordStats) => number | null; display?: (stats: RecordStats) => string | number };
const divide = (numerator: number, denominator: number) => denominator ? numerator / denominator : null;
const battingColumns: StatColumn[] = [
  { id: "strikeouts", label: "삼진", value: (s) => s.batting?.strikeouts ?? null, display: (s) => s.batting?.strikeouts ?? "미수집" },
  { id: "stolenBases", label: "도루", value: (s) => s.batting?.stolenBases ?? null, display: (s) => s.batting?.stolenBases ?? "미수집" },
  { id: "games", label: "경기", value: (s) => s.batting?.games ?? 0 },
  { id: "plateAppearances", label: "타석", value: (s) => (s.batting?.atBats ?? 0) + (s.batting?.walks ?? 0) + (s.batting?.hitByPitch ?? 0) + (s.batting?.sacrificeFlies ?? 0) },
  { id: "atBats", label: "타수", value: (s) => s.batting?.atBats ?? 0 }, { id: "hits", label: "안타", value: (s) => s.batting?.hits ?? 0 },
  { id: "homeRuns", label: "홈런", value: (s) => s.batting?.homeRuns ?? 0 }, { id: "rbi", label: "타점", value: (s) => s.batting?.rbi ?? 0 },
  { id: "walks", label: "볼넷", value: (s) => s.batting?.walks ?? 0 }, { id: "hitByPitch", label: "사구", value: (s) => s.batting?.hitByPitch ?? 0 },
  { id: "sacrificeFlies", label: "희생플라이", value: (s) => s.batting?.sacrificeFlies ?? 0 }, { id: "totalBases", label: "총루타", value: (s) => s.batting?.totalBases ?? 0 },
  { id: "average", label: "타율", value: (s) => s.batting?.average ?? null, display: (s) => number(s.batting?.average) },
  { id: "obp", label: "출루율", value: (s) => { const b=s.batting!; return divide(b.hits+(b.walks??0)+(b.hitByPitch??0),b.atBats+(b.walks??0)+(b.hitByPitch??0)+(b.sacrificeFlies??0)); }, display: (s) => number(battingColumns.find((c) => c.id === "obp")!.value(s)) },
  { id: "slg", label: "장타율", value: (s) => divide(s.batting?.totalBases ?? 0,s.batting?.atBats ?? 0), display: (s) => number(battingColumns.find((c) => c.id === "slg")!.value(s)) },
  { id: "ops", label: "OPS", value: (s) => s.batting?.ops ?? null, display: (s) => number(s.batting?.ops) },
  { id: "iso", label: "ISO", value: (s) => { const slg=divide(s.batting?.totalBases??0,s.batting?.atBats??0); return slg == null ? null : slg-(s.batting?.average??0); }, display: (s) => number(battingColumns.find((c) => c.id === "iso")!.value(s)) },
  { id: "hitsPerGame", label: "경기당 안타", value: (s) => divide(s.batting?.hits??0,s.batting?.games??0), display: (s) => number(battingColumns.find((c) => c.id === "hitsPerGame")!.value(s),2) },
  { id: "rbiPerGame", label: "경기당 타점", value: (s) => divide(s.batting?.rbi??0,s.batting?.games??0), display: (s) => number(battingColumns.find((c) => c.id === "rbiPerGame")!.value(s),2) },
  { id: "atBatsPerHomeRun", label: "홈런당 타수", value: (s) => divide(s.batting?.atBats??0,s.batting?.homeRuns??0), display: (s) => number(battingColumns.find((c) => c.id === "atBatsPerHomeRun")!.value(s),1) },
];
const pitchingColumns: StatColumn[] = [
  { id: "games", label: "경기", value: (s) => s.pitching?.games ?? 0 }, { id: "wins", label: "승", value: (s) => s.pitching?.wins ?? 0 }, { id: "losses", label: "패", value: (s) => s.pitching?.losses ?? 0 },
  { id: "innings", label: "이닝", value: (s) => (s.pitching?.pitchingOuts ?? 0)/3, display: (s) => s.pitching?.innings ?? "0" },
  { id: "strikeouts", label: "탈삼진", value: (s) => s.pitching?.strikeouts ?? 0 }, { id: "hitsAllowed", label: "피안타", value: (s) => s.pitching?.hitsAllowed ?? 0 },
  { id: "walks", label: "볼넷", value: (s) => s.pitching?.walks ?? 0 }, { id: "earnedRuns", label: "자책점", value: (s) => s.pitching?.earnedRuns ?? 0 },
  { id: "era", label: "방어율", value: (s) => s.pitching?.era ?? null, display: (s) => number(s.pitching?.era,2) }, { id: "whip", label: "WHIP", value: (s) => s.pitching?.whip ?? null, display: (s) => number(s.pitching?.whip,2) },
  { id: "winPct", label: "승률", value: (s) => divide(s.pitching?.wins??0,(s.pitching?.wins??0)+(s.pitching?.losses??0)), display: (s) => number(pitchingColumns.find((c) => c.id === "winPct")!.value(s)) },
  { id: "inningsPerGame", label: "경기당 이닝", value: (s) => divide((s.pitching?.pitchingOuts??0)/3,s.pitching?.games??0), display: (s) => number(pitchingColumns.find((c) => c.id === "inningsPerGame")!.value(s),2) },
  { id: "k7", label: "K/7", value: (s) => divide((s.pitching?.strikeouts??0)*21,s.pitching?.pitchingOuts??0), display: (s) => number(pitchingColumns.find((c) => c.id === "k7")!.value(s),2) },
  { id: "bb7", label: "BB/7", value: (s) => divide((s.pitching?.walks??0)*21,s.pitching?.pitchingOuts??0), display: (s) => number(pitchingColumns.find((c) => c.id === "bb7")!.value(s),2) },
  { id: "h7", label: "H/7", value: (s) => divide((s.pitching?.hitsAllowed??0)*21,s.pitching?.pitchingOuts??0), display: (s) => number(pitchingColumns.find((c) => c.id === "h7")!.value(s),2) },
  { id: "kbb", label: "K/BB", value: (s) => divide(s.pitching?.strikeouts??0,s.pitching?.walks??0), display: (s) => number(pitchingColumns.find((c) => c.id === "kbb")!.value(s),2) },
];

export default function TeamRecords() {
  const [entries, setEntries] = useState<Record<string, Entry[]>>({ 썬볼: [], 레드포니즈: [] });
  const [latest, setLatest] = useState<LatestGame[]>([]);
  const [team, setTeam] = useState("썬볼");
  const [season, setSeason] = useState("career");
  const [source, setSource] = useState<Source>("combined");
  const [kind, setKind] = useState<"batting" | "pitching">("batting");
  const [sortKey, setSortKey] = useState("average");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [visibleBatting, setVisibleBatting] = useState(() => battingColumns.map((column) => column.id));
  const [visiblePitching, setVisiblePitching] = useState(() => pitchingColumns.map((column) => column.id));
  const [battingGamesRuleEnabled, setBattingGamesRuleEnabled] = useState(false);
  const [plateAppearancesRuleEnabled, setPlateAppearancesRuleEnabled] = useState(false);
  const [pitchingGamesRuleEnabled, setPitchingGamesRuleEnabled] = useState(false);
  const [inningsRuleEnabled, setInningsRuleEnabled] = useState(false);
  const [requiredBattingGames, setRequiredBattingGames] = useState(1);
  const [requiredPitchingGames, setRequiredPitchingGames] = useState(1);
  const [requiredPlateAppearances, setRequiredPlateAppearances] = useState(1);
  const [requiredInnings, setRequiredInnings] = useState(1);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const topScrollInnerRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

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
        if (next[teamName] && stats) next[teamName].push({ name: canonicalPlayerName(name), source: sourceName, season: year, stats });
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
  const allColumns = kind === "batting" ? battingColumns : pitchingColumns;
  const visibleIds = kind === "batting" ? visibleBatting : visiblePitching;
  const activeColumns = allColumns.filter((column) => visibleIds.includes(column.id));
  const sortColumn = allColumns.find((column) => column.id === sortKey) ?? allColumns[0];
  const qualificationEnabled = kind === "batting" ? battingGamesRuleEnabled || plateAppearancesRuleEnabled : pitchingGamesRuleEnabled || inningsRuleEnabled;
  const plateAppearances = (stats: RecordStats) => (stats.batting?.atBats ?? 0) + (stats.batting?.walks ?? 0) + (stats.batting?.hitByPitch ?? 0) + (stats.batting?.sacrificeFlies ?? 0);
  const qualified = (stats: RecordStats) => kind === "batting"
    ? (!battingGamesRuleEnabled || (stats.batting?.games ?? 0) >= requiredBattingGames) && (!plateAppearancesRuleEnabled || plateAppearances(stats) >= requiredPlateAppearances)
    : (!pitchingGamesRuleEnabled || (stats.pitching?.games ?? 0) >= requiredPitchingGames) && (!inningsRuleEnabled || (stats.pitching?.pitchingOuts ?? 0) >= requiredInnings * 3);
  const participatingPlayers = players.filter((player) => kind === "batting" ? (player.stats.batting?.games ?? 0) > 0 : (player.stats.pitching?.games ?? 0) > 0);
  const sorted = [...participatingPlayers].sort((a, b) => {
    if (qualificationEnabled && qualified(a.stats) !== qualified(b.stats)) return qualified(a.stats) ? -1 : 1;
    const aValue = sortColumn.value(a.stats); const bValue = sortColumn.value(b.stats);
    if (aValue == null && bValue != null) return 1; if (aValue != null && bValue == null) return -1;
    const difference = Number(aValue ?? 0) - Number(bValue ?? 0);
    return sortDirection === "asc" ? difference : -difference;
  });
  const game = latest.find((item) => item.team === team);

  useEffect(() => {
    const top = topScrollRef.current; const topInner = topScrollInnerRef.current; const tableScroll = tableScrollRef.current; const tableElement = tableRef.current;
    if (!top || !topInner || !tableScroll || !tableElement) return;
    let syncing = false;
    const resize = () => { topInner.style.width = `${tableElement.scrollWidth}px`; };
    const fromTop = () => { if (syncing) return; syncing = true; tableScroll.scrollLeft = top.scrollLeft; syncing = false; };
    const fromTable = () => { if (syncing) return; syncing = true; top.scrollLeft = tableScroll.scrollLeft; syncing = false; };
    const observer = new ResizeObserver(resize);
    observer.observe(tableElement); resize(); top.addEventListener("scroll", fromTop); tableScroll.addEventListener("scroll", fromTable);
    return () => { observer.disconnect(); top.removeEventListener("scroll", fromTop); tableScroll.removeEventListener("scroll", fromTable); };
  }, []);

  const downloadExcel = () => {
    const headers = ["순위", "선수", "출처", ...activeColumns.map((column) => column.label)];
    const rows = sorted.map((player, index) => {
      const meetsRule = qualified(player.stats);
      const rank = qualificationEnabled && !meetsRule ? "-" : qualificationEnabled ? sorted.slice(0, index + 1).filter((item) => qualified(item.stats)).length : index + 1;
      const sourceNames = [...player.sources].map((item) => SOURCES.find((sourceItem) => sourceItem.id === item)?.label).filter(Boolean).join(" · ");
      return [rank, player.name, sourceNames, ...activeColumns.map((column) => column.display ? column.display(player.stats) : column.value(player.stats) ?? "-")];
    });
    const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    const sourceLabel = SOURCES.find((item) => item.id === source)?.label ?? source;
    anchor.href = url;
    anchor.download = `${team}_${season === "career" ? "통산" : season}_${sourceLabel}_${kind === "batting" ? "타자" : "투수"}_기록.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };

  const changeKind = (nextKind: "batting" | "pitching") => {
    setKind(nextKind); setSortKey(nextKind === "batting" ? "average" : "era"); setSortDirection(nextKind === "batting" ? "desc" : "asc");
  };
  const toggleColumn = (id: string) => {
    const setter = kind === "batting" ? setVisibleBatting : setVisiblePitching;
    setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

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
      <Summary icon={<Activity />} label="팀 타자 삼진" value={teamStats?.batting?.strikeouts ?? "미수집"} />
      <Summary icon={<Activity />} label="팀 도루" value={teamStats?.batting?.stolenBases ?? "미수집"} />
    </div>

    {game && <article className="team-latest-game"><div><span className="latest-label"><CalendarDays size={14} /> 최근 통합 경기</span><h3>{game.opponent}<small>{game.source}</small></h3></div><div className="latest-score"><strong>{game.teamScore}</strong><span className={`result-${game.result}`}>{game.result}</span><strong>{game.opponentScore}</strong></div><time>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(new Date(game.gameDate))}</time></article>}

    <div className="team-ranking-head"><div><h3>선수 기록 순위</h3><p>{source === "combined" ? "서비스별 기록을 합산한 값입니다." : `${SOURCES.find((item) => item.id === source)?.label} 기록입니다.`} · {qualificationEnabled ? (kind === "batting" ? [battingGamesRuleEnabled && `${requiredBattingGames}경기`, plateAppearancesRuleEnabled && `${requiredPlateAppearances}타석`].filter(Boolean).join(" · ") : [pitchingGamesRuleEnabled && `${requiredPitchingGames}경기`, inningsRuleEnabled && `${requiredInnings}이닝`].filter(Boolean).join(" · ")) : "규정 적용 안 함"}</p></div><div className="ranking-actions"><label><select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>{allColumns.map((column) => <option key={column.id} value={column.id}>{column.label}순</option>)}</select><ChevronDown size={13} /></label><button type="button" className="sort-direction" onClick={() => setSortDirection((value) => value === "asc" ? "desc" : "asc")} aria-label={sortDirection === "asc" ? "오름차순" : "내림차순"}>{sortDirection === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />} {sortDirection === "asc" ? "오름차순" : "내림차순"}</button><div className="team-kind-toggle"><button className={kind === "batting" ? "active" : ""} onClick={() => changeKind("batting")}>타자</button><button className={kind === "pitching" ? "active" : ""} onClick={() => changeKind("pitching")}>투수</button></div><button type="button" className="excel-download" onClick={downloadExcel} disabled={!sorted.length}><Download size={14} /> 엑셀 다운로드</button></div></div>
    <div className="ranking-options">
      <div className="qualification-control">{kind === "batting" ? <><label><input type="checkbox" checked={battingGamesRuleEnabled} onChange={(event) => setBattingGamesRuleEnabled(event.target.checked)} /> 경기 수</label><input type="number" min="0" step="1" disabled={!battingGamesRuleEnabled} value={requiredBattingGames} onChange={(event) => setRequiredBattingGames(Math.max(0, Number(event.target.value)))} /><span>경기</span><label><input type="checkbox" checked={plateAppearancesRuleEnabled} onChange={(event) => setPlateAppearancesRuleEnabled(event.target.checked)} /> 타석 수</label><input type="number" min="0" step="1" disabled={!plateAppearancesRuleEnabled} value={requiredPlateAppearances} onChange={(event) => setRequiredPlateAppearances(Math.max(0, Number(event.target.value)))} /><span>타석</span></> : <><label><input type="checkbox" checked={pitchingGamesRuleEnabled} onChange={(event) => setPitchingGamesRuleEnabled(event.target.checked)} /> 경기 수</label><input type="number" min="0" step="1" disabled={!pitchingGamesRuleEnabled} value={requiredPitchingGames} onChange={(event) => setRequiredPitchingGames(Math.max(0, Number(event.target.value)))} /><span>경기</span><label><input type="checkbox" checked={inningsRuleEnabled} onChange={(event) => setInningsRuleEnabled(event.target.checked)} /> 이닝</label><input type="number" min="0" step="0.1" disabled={!inningsRuleEnabled} value={requiredInnings} onChange={(event) => setRequiredInnings(Math.max(0, Number(event.target.value)))} /><span>이닝</span></>}</div>
      <details className="column-picker"><summary><ListFilter size={14} /> 표시 항목 <b>{activeColumns.length}/{allColumns.length}</b></summary><div className="column-picker-menu"><div><button type="button" onClick={() => kind === "batting" ? setVisibleBatting(battingColumns.map((column) => column.id)) : setVisiblePitching(pitchingColumns.map((column) => column.id))}>전체 선택</button><button type="button" onClick={() => kind === "batting" ? setVisibleBatting([]) : setVisiblePitching([])}>전체 해제</button></div>{allColumns.map((column) => <label key={column.id}><input type="checkbox" checked={visibleIds.includes(column.id)} onChange={() => toggleColumn(column.id)} /> {column.label}</label>)}</div></details>
    </div>
    <p className="mobile-table-hint">선수 이름은 고정됩니다 · 기록은 좌우로 밀어서 확인하세요</p>
    <div className="team-ranking-scroll-top" ref={topScrollRef} aria-label="기록 표 가로 스크롤"><div ref={topScrollInnerRef} /></div>
    <div className="team-ranking-table" ref={tableScrollRef}><table ref={tableRef}><thead><tr><th>순위</th><th>선수</th>{activeColumns.map((column) => <th key={column.id} className={column.id === sortKey ? "sort-column" : ""}>{column.label}</th>)}</tr></thead><tbody>{sorted.map((player, index) => {
      const meetsRule = qualified(player.stats); const rank = qualificationEnabled && !meetsRule ? null : qualificationEnabled ? sorted.slice(0, index + 1).filter((item) => qualified(item.stats)).length : index + 1;
      return <tr key={clean(player.name)} className={!meetsRule ? "unqualified" : ""}><td><span className={rank ? `rank top-${rank}` : "rank"}>{rank ?? "-"}</span></td><td><div className="team-player-name"><b>{player.name}{!meetsRule && <i>규정 미달</i>}</b><small>{[...player.sources].map((item) => SOURCES.find((sourceItem) => sourceItem.id === item)?.label).join(" · ")}</small></div></td>{activeColumns.map((column) => <td key={column.id} className={column.id === sortKey ? "sort-column" : ""}>{column.display ? column.display(player.stats) : column.value(player.stats) ?? "-"}</td>)}</tr>;
    })}</tbody></table>{!sorted.length && <p className="directory-empty">선택한 조건의 기록이 없습니다.</p>}</div>
    {source === "combined" && <p className="team-record-note">통합 탭은 현재 서비스별 누적 기록을 합산합니다. 동일 경기가 여러 서비스에 등록된 경우의 경기 단위 중복 제거는 전체 경기 목록 수집 후 적용됩니다.</p>}
  </section>;
}

function Summary({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string | number; suffix?: string }) {
  return <article className="team-summary"><span>{icon}</span><div><small>{label}</small><strong>{value}{suffix && <em>{suffix}</em>}</strong></div></article>;
}
