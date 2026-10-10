import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const outputFile = path.resolve(".data", "latest-games.json");
const headers = { "User-Agent": "Mozilla/5.0 Chrome/131.0", "Accept-Language": "ko-KR,ko;q=0.9" };

async function fetchText(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url} 요청 실패 (${response.status})`);
  return response.text();
}

function outcome(teamScore, opponentScore) {
  return teamScore === opponentScore ? "무" : teamScore > opponentScore ? "승" : "패";
}

function decode(value) {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function latestSunball() {
  const response = JSON.parse(await fetchText("http://www.nicecatch.kr/api/team/fedca0e9-c756-4d80-a8bd-a33789017dbb/game/recent/1"));
  const game = response.data?.[0];
  if (!game) throw new Error("나이스캐치 썬볼 최근 경기가 없습니다.");
  const isVisit = game.visitTeamId === "fedca0e9-c756-4d80-a8bd-a33789017dbb";
  const teamScore = Number(isVisit ? game.visitScore : game.homeScore);
  const opponentScore = Number(isVisit ? game.homeScore : game.visitScore);
  return {
    team: "썬볼",
    source: `나이스캐치 · ${game.league?.leagueMain?.mainName ?? "강서구야구소프트볼협회"}`,
    gameDate: game.startTime,
    opponent: isVisit ? game.leagueSchedule?.homeTeamInfo?.teamName : game.leagueSchedule?.visitTeamInfo?.teamName,
    teamScore, opponentScore, result: outcome(teamScore, opponentScore),
  };
}

async function latestGameone(clubId, team, sourceName) {
  const home = await fetchText(`https://gameone.kr/club/?club_idx=${clubId}`);
  const ids = [...new Set([...home.matchAll(new RegExp(`boxscore\\?club_idx=${clubId}(?:&amp;|&)game_idx=(\\d+)`, "g"))].map((match) => match[1]))];
  const games = [];
  for (const id of ids.slice(0, 8)) {
    const html = await fetchText(`https://gameone.kr/club/info/schedule/boxscore?club_idx=${clubId}&game_idx=${id}`);
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    const match = text.match(/([^\s]+)\s+(?:승|패|무)\s+(\d+)\s+([^\s]+)\s+(?:승|패|무)\s+(\d+)\s+(\d{2})년[^/]*\/\s*(\d{2})\.(\d{2})\(/);
    if (!match || ![match[1], match[3]].includes(sourceName)) continue;
    const teamFirst = match[1] === sourceName;
    const teamScore = Number(teamFirst ? match[2] : match[4]);
    const opponentScore = Number(teamFirst ? match[4] : match[2]);
    games.push({
      team, source: `게임원 · ${match[5]}년 리그`, sourceId: "gameone",
      gameDate: new Date(Date.UTC(2000 + Number(match[5]), Number(match[6]) - 1, Number(match[7]))).toISOString(),
      opponent: teamFirst ? match[3] : match[1], teamScore, opponentScore,
      result: outcome(teamScore, opponentScore),
    });
  }
  const latest = games.sort((a, b) => Date.parse(b.gameDate) - Date.parse(a.gameDate))[0];
  if (!latest) throw new Error(`게임원 ${team} 최근 경기를 찾지 못했습니다.`);
  return latest;
}

async function latestYagoos() {
  const html = await fetchText("https://aa.yagoos.com/team/sunball/match/result");
  const games = [...html.matchAll(/<div class="score_board">([\s\S]*?)(?=<div class="score_board">|<\/div>\s*<\/div>\s*<\/div>\s*$)/gi)].map((match) => {
    const block = match[1];
    const teams = [...block.matchAll(/<div class="team">([\s\S]*?)<\/div>[\s\S]*?<div class="score">\s*(\d+)\s*<\/div>/gi)]
      .map((item) => ({ name: decode(item[1]), score: Number(item[2]) }));
    const date = decode(block.match(/<div class="date">([\s\S]*?)<\/div>/i)?.[1] ?? "").match(/(\d{2})\.(\d{2})\.(\d{2})/);
    if (teams.length !== 2 || !date) return null;
    const index = teams.findIndex((item) => item.name === "썬볼");
    if (index < 0) return null;
    const other = teams[1 - index];
    const teamScore = teams[index].score;
    return { team: "썬볼", source: "야구스", sourceId: "yagoos", gameDate: new Date(Date.UTC(2000 + Number(date[1]), Number(date[2]) - 1, Number(date[3]))).toISOString(), opponent: other.name, teamScore, opponentScore: other.score, result: outcome(teamScore, other.score) };
  }).filter(Boolean);
  const latest = games.sort((a, b) => Date.parse(b.gameDate) - Date.parse(a.gameDate))[0];
  if (!latest) throw new Error("야구스 썬볼 최근 경기를 찾지 못했습니다.");
  return latest;
}

async function storedUniquePlay() {
  try {
    const snapshot = JSON.parse(await readFile(path.resolve(".data", "uniqueplay-latest-games.json"), "utf8"));
    return Array.isArray(snapshot.teams) ? snapshot.teams : [];
  } catch { return []; }
}

async function storedInactiveSources() {
  try {
    const snapshot = JSON.parse(await readFile(outputFile, "utf8"));
    return (snapshot.sources ?? []).filter((game) => ["gameone", "yagoos"].includes(game.sourceId));
  } catch { return []; }
}

const collected = await Promise.allSettled([
  latestSunball().then((game) => ({ ...game, sourceId: "nicecatch" })),
]);
const sources = await storedInactiveSources();
sources.push(...collected.filter((item) => item.status === "fulfilled").map((item) => item.value));
sources.push(...await storedUniquePlay());
const teams = ["썬볼", "레드포니즈"].map((team) => {
  const candidates = sources.filter((game) => game.team === team).sort((a, b) => Date.parse(b.gameDate) - Date.parse(a.gameDate));
  return candidates[0] ? { ...candidates[0], comparedSources: [...new Set(candidates.map((game) => game.sourceId))] } : null;
}).filter(Boolean);
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify({ fetchedAt: new Date().toISOString(), teams, sources }, null, 2)}\n`, "utf8");
console.log(teams.map((team) => `${team.team}: ${team.gameDate.slice(0, 10)} ${team.teamScore}:${team.opponentScore} vs ${team.opponent}`).join("\n"));
