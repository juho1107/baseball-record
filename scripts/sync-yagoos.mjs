import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ORIGIN = "https://aa.yagoos.com";
const TEAM = { code: "sunball", name: "썬볼" };
const outputFile = path.resolve(".data", "yagoos-snapshot.json");

function decode(value) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ").trim();
}

function number(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullable(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return null;
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function inningsToOuts(value) {
  const [whole, fraction = "0"] = String(value || "0").split(".");
  return number(whole) * 3 + Math.min(number(fraction), 2);
}

function rows(html) {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decode(cell[1])))
    .filter((cells) => cells.length > 2 && /^\d+$/.test(cells[0]));
}

function playerName(value) {
  return value.replace(/\s*\(\d+\)\s*$/, "").trim();
}

function mergeRankingRows(...groups) {
  const merged = new Map();
  for (const cells of groups.flat()) {
    merged.set(playerName(cells[1]), cells);
  }
  return [...merged.values()];
}

async function get(url) {
  const response = await fetch(url, { headers: { "User-Agent": "DUGOUT baseball record sync/1.0", "Accept-Language": "ko-KR,ko;q=0.9" } });
  if (!response.ok) throw new Error(`${url} 요청 실패 (${response.status})`);
  return response.text();
}

const rankingPage = await get(`${ORIGIN}/team/${TEAM.code}/record/batting/ranking`);
const seasons = [...rankingPage.matchAll(/class="season-item"\s+data-value="(\d{4})"/g)].map((match) => Number(match[1]));
const leagueCodes = [...rankingPage.matchAll(/data-league-aa-code="([^"]+)"/g)].map((match) => match[1]);
const leagueCode = leagueCodes[0];
if (!leagueCode || !seasons.length) throw new Error("야구스의 썬볼 시즌/리그 정보를 찾지 못했습니다.");

const players = new Map();
for (const season of seasons.sort((a, b) => a - b)) {
  const query = `season=${season}&leaguea=${encodeURIComponent(leagueCode)}`;
  const [battingInHtml, battingOutHtml, pitchingInHtml, pitchingOutHtml] = await Promise.all([
    get(`${ORIGIN}/getpage/team/${TEAM.code}/record/load?base=player/ranking/b&${query}&rules=IN`),
    get(`${ORIGIN}/getpage/team/${TEAM.code}/record/load?base=player/ranking/b&${query}&rules=OUT`),
    get(`${ORIGIN}/getpage/team/${TEAM.code}/record/load?base=player/ranking/p&${query}&rules=IN`),
    get(`${ORIGIN}/getpage/team/${TEAM.code}/record/load?base=player/ranking/p&${query}&rules=OUT`),
  ]);
  const battingRows = mergeRankingRows(rows(battingInHtml), rows(battingOutHtml));
  const pitchingRows = mergeRankingRows(rows(pitchingInHtml), rows(pitchingOutHtml));
  const seasonMap = new Map();
  for (const cells of battingRows) {
    const name = playerName(cells[1]);
    const atBats = number(cells[6]);
    const hits = number(cells[7]);
    const batting = {
      games: number(cells[3]), atBats, average: nullable(cells[4]) ?? (atBats ? hits / atBats : 0), hits,
      homeRuns: number(cells[11]), rbi: number(cells[13]), ops: nullable(cells[17]), totalBases: number(cells[12]),
      walks: number(cells[23]), hitByPitch: number(cells[24]), sacrificeFlies: number(cells[28]),
      strikeouts: nullable(cells[26]), stolenBases: nullable(cells[20]),
    };
    seasonMap.set(name, { batting });
  }
  for (const cells of pitchingRows) {
    const name = playerName(cells[1]);
    const pitchingOuts = inningsToOuts(cells[5]);
    const pitching = {
      games: number(cells[3]), era: nullable(cells[4]), wins: number(cells[6]), losses: number(cells[7]), innings: cells[5] || "0",
      strikeouts: number(cells[10]), whip: nullable(cells[22]), pitchingOuts, hitsAllowed: number(cells[11]),
      walks: number(cells[16]), earnedRuns: number(cells[20]),
    };
    seasonMap.set(name, { ...(seasonMap.get(name) ?? {}), pitching });
  }
  for (const [name, partial] of seasonMap) {
    const batting = partial.batting ?? { games: 0, atBats: 0, average: 0, hits: 0, homeRuns: 0, rbi: 0, ops: 0, totalBases: 0, walks: 0, hitByPitch: 0, sacrificeFlies: 0 };
    const pitching = partial.pitching ?? { games: 0, era: null, wins: 0, losses: 0, innings: "0", strikeouts: 0, whip: null, pitchingOuts: 0, hitsAllowed: 0, walks: 0, earnedRuns: 0 };
    const stats = { games: Math.max(batting.games, pitching.games), average: batting.average, hits: batting.hits, homeRuns: batting.homeRuns, rbi: batting.rbi, ops: batting.ops, era: pitching.era, batting, pitching };
    const player = players.get(name) ?? { name, seasonRecords: [] };
    player.seasonRecords.push({ season, stats });
    players.set(name, player);
  }
  console.log(`${season}: 타자 ${battingRows.length}명, 투수 ${pitchingRows.length}명 (규정 IN/OUT 통합)`);
}

const snapshot = { schemaVersion: 1, source: "YAGOOS", fetchedAt: new Date().toISOString(), teams: [{ id: TEAM.code, name: TEAM.name, leagueCode, players: [...players.values()] }] };
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`완료: ${players.size}명의 야구스 기록을 ${outputFile}에 저장했습니다.`);
