import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ORIGIN = "http://www.nicecatch.kr";
const LEAGUE_PATH = "gangseo";
const TEAM_ID = "fedca0e9-c756-4d80-a8bd-a33789017dbb";
const TEAM_NAME = "썬볼";
const outputFile = path.resolve(".data", "nicecatch-snapshot.json");
const numeric = (value) => Number(value) || 0;
const outsToInnings = (outs) => `${Math.floor(outs / 3)}${outs % 3 ? `.${outs % 3}` : ""}`;

async function api(pathname) {
  const response = await fetch(`${ORIGIN}${pathname}`, { headers: { Accept: "application/json", "User-Agent": "DUGOUT baseball record sync/1.0" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${pathname} 요청 실패 (${response.status})`);
  const body = await response.json();
  if (!body.ok) throw new Error(`${pathname} 응답 오류`);
  return body.data;
}

function batting(row) {
  return {
    games: numeric(row.game_cnt), atBats: numeric(row.bat_ab), average: numeric(row.bat_avg), hits: numeric(row.bat_hits),
    homeRuns: numeric(row.bat_hr), rbi: numeric(row.bat_rbi), ops: numeric(row.bat_ops), totalBases: numeric(row.bat_tbase),
    walks: numeric(row.bat_bb), hitByPitch: numeric(row.bat_hbp), sacrificeFlies: numeric(row.bat_sf),
    strikeouts: row.bat_so == null ? null : numeric(row.bat_so), stolenBases: row.bat_sb == null ? null : numeric(row.bat_sb),
  };
}

function pitching(row) {
  const pitchingOuts = numeric(row.pit_outs);
  const hitsAllowed = numeric(row.pit_hits);
  const walks = numeric(row.pit_bb);
  const earnedRuns = numeric(row.pit_er);
  return {
    games: numeric(row.game_cnt), era: pitchingOuts ? earnedRuns * 21 / pitchingOuts : null,
    wins: numeric(row.pit_win), losses: numeric(row.pit_loss), innings: outsToInnings(pitchingOuts),
    strikeouts: numeric(row.pit_so), whip: pitchingOuts ? (hitsAllowed + walks) * 3 / pitchingOuts : null,
    pitchingOuts, hitsAllowed, walks, earnedRuns,
  };
}

function mergeRows(values, type) {
  if (type === "batting") {
    const raw = values.reduce((sum, value) => {
      const row = batting(value);
      for (const key of ["games", "atBats", "hits", "homeRuns", "rbi", "totalBases", "walks", "hitByPitch", "sacrificeFlies"]) sum[key] += row[key];
      return sum;
    }, { games: 0, atBats: 0, hits: 0, homeRuns: 0, rbi: 0, totalBases: 0, walks: 0, hitByPitch: 0, sacrificeFlies: 0 });
    const average = raw.atBats ? raw.hits / raw.atBats : 0;
    const denominator = raw.atBats + raw.walks + raw.hitByPitch + raw.sacrificeFlies;
    const ops = raw.atBats || denominator ? raw.totalBases / Math.max(raw.atBats, 1) + (raw.hits + raw.walks + raw.hitByPitch) / Math.max(denominator, 1) : 0;
    const count = (key) => values.some((value) => batting(value)[key] == null) ? null : values.reduce((sum, value) => sum + batting(value)[key], 0);
    return { ...raw, average, ops, strikeouts: count("strikeouts"), stolenBases: count("stolenBases") };
  }
  const raw = values.reduce((sum, value) => {
    const row = pitching(value);
    for (const key of ["games", "wins", "losses", "strikeouts", "pitchingOuts", "hitsAllowed", "walks", "earnedRuns"]) sum[key] += numeric(row[key]);
    return sum;
  }, { games: 0, wins: 0, losses: 0, strikeouts: 0, pitchingOuts: 0, hitsAllowed: 0, walks: 0, earnedRuns: 0 });
  return { ...raw, innings: outsToInnings(raw.pitchingOuts), era: raw.pitchingOuts ? raw.earnedRuns * 21 / raw.pitchingOuts : null, whip: raw.pitchingOuts ? (raw.hitsAllowed + raw.walks) * 3 / raw.pitchingOuts : null };
}

const main = await api(`/api/league/mainpath/${LEAGUE_PATH}`);
const seasons = await api(`/api/league/main/${main.mainId}/season`);
const players = new Map();

for (const seasonInfo of seasons) {
  const season = Number(seasonInfo.seasonName.match(/\d{4}/)?.[0]);
  const leagues = await api(`/api/league/season/${seasonInfo.seasonId}/league`);
  const participating = [];
  for (const league of leagues) {
    const teams = await api(`/api/game/rank/team/${seasonInfo.seasonId}/${league.leagueId}`);
    if (teams.some((team) => team.teamId === TEAM_ID && team.teamName === TEAM_NAME)) participating.push(league);
  }
  const seasonPlayers = new Map();
  for (const league of participating) {
    const [qualifiedBatters, otherBatters, qualifiedPitchers, otherPitchers] = await Promise.all([
      api(`/api/game/rank/batter/${seasonInfo.seasonId}/${league.leagueId}`),
      api(`/api/game/rank/subbatter/${seasonInfo.seasonId}/${league.leagueId}`),
      api(`/api/game/rank/pitcher/${seasonInfo.seasonId}/${league.leagueId}`),
      api(`/api/game/rank/subpitcher/${seasonInfo.seasonId}/${league.leagueId}`),
    ]);
    const batters = new Map([...qualifiedBatters, ...otherBatters].filter((row) => row.team_id === TEAM_ID).map((row) => [row.player_id, row]));
    const pitchers = new Map([...qualifiedPitchers, ...otherPitchers].filter((row) => row.team_id === TEAM_ID).map((row) => [row.player_id, row]));
    for (const id of new Set([...batters.keys(), ...pitchers.keys()])) {
      const row = batters.get(id) ?? pitchers.get(id);
      const item = seasonPlayers.get(id) ?? { id, name: row.player_name.trim(), battingRows: [], pitchingRows: [] };
      if (batters.has(id)) item.battingRows.push(batters.get(id));
      if (pitchers.has(id)) item.pitchingRows.push(pitchers.get(id));
      seasonPlayers.set(id, item);
    }
  }
  for (const item of seasonPlayers.values()) {
    const bat = mergeRows(item.battingRows, "batting");
    const pit = mergeRows(item.pitchingRows, "pitching");
    const stats = { games: Math.max(bat.games, pit.games), average: bat.average, hits: bat.hits, homeRuns: bat.homeRuns, rbi: bat.rbi, ops: bat.ops, era: pit.era, batting: bat, pitching: pit };
    const player = players.get(item.id) ?? { externalId: item.id, name: item.name, seasonRecords: [] };
    player.seasonRecords.push({ season, stats });
    players.set(item.id, player);
  }
  console.log(`${season}: ${participating.length}개 리그, 선수 ${seasonPlayers.size}명`);
}

const snapshot = { schemaVersion: 1, source: "NICECATCH", fetchedAt: new Date().toISOString(), teams: [{ id: TEAM_ID, name: TEAM_NAME, league: "강서구야구소프트볼협회", players: [...players.values()] }] };
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`완료: 나이스캐치 썬볼 선수 ${players.size}명 저장`);
