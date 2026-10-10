import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set(["gameone.kr", "www.gameone.kr"]);
const PROFILE_PATH = "/locker/record/sum";
const GAMEONE_TEAM_ALIASES = new Map([
  ["썬볼", { id: "sunball", name: "썬볼" }],
  ["redponies", { id: "redponies", name: "레드포니즈" }],
  ["레드포니즈", { id: "redponies", name: "레드포니즈" }],
]);

function selectedTeam(name: string) {
  return GAMEONE_TEAM_ALIASES.get(name.replace(/[\s_-]/g, "").toLowerCase()) ?? null;
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function readStats(section: string) {
  const stats: Record<string, string> = {};
  const pattern = /<span[^>]*class=["']title["'][^>]*>([\s\S]*?)<\/span>\s*<span[^>]*class=["']score["'][^>]*>([\s\S]*?)<\/span>/gi;
  for (const match of section.matchAll(pattern)) stats[stripTags(match[1])] = stripTags(match[2]);
  return stats;
}

type PublicStats = {
  games: number; average: number; hits: number; homeRuns: number; rbi: number; ops: number; era: number | null;
  atBats: number; totalBases: number; walks: number; hitByPitch: number; sacrificeFlies: number;
  pitchingOuts: number; earnedRuns: number;
  batting: BattingStats; pitching: PitchingStats;
};
type BattingStats = { games: number; atBats: number; average: number; hits: number; homeRuns: number | null; rbi: number; ops: number | null; totalBases: number; walks: number; hitByPitch: number; sacrificeFlies: number };
type PitchingStats = { games: number; era: number | null; wins: number | null; losses: number | null; saves: number | null; holds: number | null; innings: string; pitchingOuts: number; hitsAllowed: number; walks: number | null; strikeouts: number | null; earnedRuns: number; whip: number | null };
type TeamStats = { games: number; average: number; hits: number; homeRuns: number | null; rbi: number; ops: number | null; era: number | null; atBats: number; batting: BattingStats; pitching: PitchingStats };
type GameRef = { gameId: string; leagueId: string; season: number; clubId: string; teamName: string };
type GameBatting = { atBats: number; hits: number; runs: number; rbi: number; stolenBases: number; doubles: number; triples: number; homeRuns: number; walks: number; hitByPitch: number; sacrificeFlies: number; sacrificeHits: number; strikeouts: number; doublePlays: number };
type GamePitching = { result: string; pitchingOuts: number; hitsAllowed: number; homeRunsAllowed: number; walks: number; hitByPitch: number; strikeouts: number; runs: number; earnedRuns: number; pitches: number };
type GameRecord = GameRef & { batting: GameBatting | null; pitching: GamePitching | null };

const numberOf = (value?: string) => Number(String(value ?? "0").replace(/,/g, "")) || 0;

function inningsToOuts(value?: string) {
  const normalized = String(value ?? "0").replace("⅓", ".1").replace("⅔", ".2").replace(/\s/g, "");
  const [whole, fraction = "0"] = normalized.split(".");
  return numberOf(whole) * 3 + Math.min(numberOf(fraction), 2);
}

function outsToInnings(outs: number) { return `${Math.floor(outs / 3)}${outs % 3 ? `.${outs % 3}` : ""}`; }

function parsePublicStats(html: string): PublicStats {
  const batting = readStats(pageSection(html, "hitter_section", "pitcher_section"));
  const pitching = readStats(pageSection(html, "pitcher_section"));
  const battingStats: BattingStats = {
    games: numberOf(batting["경기수"]), atBats: numberOf(batting["타수"]), average: numberOf(batting["타율"]),
    hits: numberOf(batting["총안타"]), homeRuns: numberOf(batting["홈런"]), rbi: numberOf(batting["타점"]), ops: numberOf(batting["OPS"]),
    totalBases: numberOf(batting["루타"]), walks: numberOf(batting["볼넷"]), hitByPitch: numberOf(batting["사구"]), sacrificeFlies: numberOf(batting["희비"]),
  };
  const pitchingOuts = inningsToOuts(pitching["이닝"]);
  const pitchingGames = numberOf(pitching["경기수"]);
  const pitchingStats: PitchingStats = {
    games: pitchingGames, era: pitchingGames ? numberOf(pitching["방어율"]) : null,
    wins: numberOf(pitching["승"]), losses: numberOf(pitching["패"]), saves: numberOf(pitching["세"]), holds: numberOf(pitching["홀드"]),
    innings: outsToInnings(pitchingOuts), pitchingOuts, hitsAllowed: numberOf(pitching["피안타"]), walks: numberOf(pitching["볼넷"]),
    strikeouts: numberOf(pitching["탈삼진"]), earnedRuns: numberOf(pitching["자책점"]), whip: pitchingGames ? numberOf(pitching["WHIP"]) : null,
  };
  return {
    games: Math.max(battingStats.games, pitchingStats.games), average: battingStats.average, hits: battingStats.hits,
    homeRuns: battingStats.homeRuns ?? 0, rbi: battingStats.rbi, ops: battingStats.ops ?? 0, era: pitchingStats.era,
    atBats: numberOf(batting["타수"]), totalBases: numberOf(batting["루타"]), walks: numberOf(batting["볼넷"]),
    hitByPitch: numberOf(batting["사구"]), sacrificeFlies: numberOf(batting["희비"]),
    pitchingOuts, earnedRuns: pitchingStats.earnedRuns, batting: battingStats, pitching: pitchingStats,
  };
}

function careerStats(seasons: Array<{ stats: PublicStats }>): PublicStats {
  const sum = seasons.reduce((total, season) => ({
    games: total.games + season.stats.games, hits: total.hits + season.stats.hits,
    homeRuns: total.homeRuns + season.stats.homeRuns, rbi: total.rbi + season.stats.rbi,
    atBats: total.atBats + season.stats.atBats, totalBases: total.totalBases + season.stats.totalBases,
    walks: total.walks + season.stats.walks, hitByPitch: total.hitByPitch + season.stats.hitByPitch,
    sacrificeFlies: total.sacrificeFlies + season.stats.sacrificeFlies,
    pitchingOuts: total.pitchingOuts + season.stats.pitchingOuts, earnedRuns: total.earnedRuns + season.stats.earnedRuns,
  }), { games: 0, hits: 0, homeRuns: 0, rbi: 0, atBats: 0, totalBases: 0, walks: 0, hitByPitch: 0, sacrificeFlies: 0, pitchingOuts: 0, earnedRuns: 0 });
  const average = sum.atBats ? sum.hits / sum.atBats : 0;
  const slugging = sum.atBats ? sum.totalBases / sum.atBats : 0;
  const obpDenominator = sum.atBats + sum.walks + sum.hitByPitch + sum.sacrificeFlies;
  const onBase = obpDenominator ? (sum.hits + sum.walks + sum.hitByPitch) / obpDenominator : 0;
  const weightedEra = sum.pitchingOuts
    ? seasons.reduce((total, season) => total + (season.stats.era ?? 0) * season.stats.pitchingOuts, 0) / sum.pitchingOuts
    : null;
  const pitchingGames = seasons.reduce((total, season) => total + season.stats.pitching.games, 0);
  const totalHitsAllowed = seasons.reduce((total, season) => total + season.stats.pitching.hitsAllowed, 0);
  const totalPitchingWalks = seasons.reduce((total, season) => total + (season.stats.pitching.walks ?? 0), 0);
  const batting: BattingStats = { games: seasons.reduce((total, season) => total + season.stats.batting.games, 0), atBats: sum.atBats, average, hits: sum.hits, homeRuns: sum.homeRuns, rbi: sum.rbi, ops: onBase + slugging, totalBases: sum.totalBases, walks: sum.walks, hitByPitch: sum.hitByPitch, sacrificeFlies: sum.sacrificeFlies };
  const pitching: PitchingStats = {
    games: pitchingGames, era: weightedEra,
    wins: seasons.reduce((total, season) => total + (season.stats.pitching.wins ?? 0), 0), losses: seasons.reduce((total, season) => total + (season.stats.pitching.losses ?? 0), 0),
    saves: seasons.reduce((total, season) => total + (season.stats.pitching.saves ?? 0), 0), holds: seasons.reduce((total, season) => total + (season.stats.pitching.holds ?? 0), 0),
    innings: outsToInnings(sum.pitchingOuts), pitchingOuts: sum.pitchingOuts,
    hitsAllowed: totalHitsAllowed, walks: totalPitchingWalks,
    strikeouts: seasons.reduce((total, season) => total + (season.stats.pitching.strikeouts ?? 0), 0), earnedRuns: sum.earnedRuns,
    whip: sum.pitchingOuts ? (totalHitsAllowed + totalPitchingWalks) * 3 / sum.pitchingOuts : null,
  };
  return { ...sum, average, ops: onBase + slugging, era: weightedEra, batting, pitching };
}

function parseTeamOptions(html: string) {
  const select = html.match(/<select\s+name=["']club_idx["'][^>]*>([\s\S]*?)<\/select>/i)?.[1] ?? "";
  return [...select.matchAll(/<option\s+value=["'](\d+)["'][^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => ({ clubId: match[1], name: stripTags(match[2]) })).filter((team) => team.name);
}

function parseTeamStats(html: string): TeamStats {
  const hitter = pageSection(html, "hitter_section", "pitcher_section");
  const pitcher = pageSection(html, "pitcher_section");
  const list = hitter.match(/<ul[^>]*class=["'][^"']*game_list[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? "";
  const games = [...list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => stripTags(match[1]));
  const gameIds = new Set([...`${hitter}${pitcher}`.matchAll(/game_idx=(\d+)/gi)].map((match) => match[1]));
  const total = games.reduce((sum, game) => {
    const atBats = numberOf(game.match(/(\d+)타수/)?.[1]);
    const hits = numberOf(game.match(/(\d+)안타/)?.[1]);
    const rbi = numberOf(game.match(/(\d+)타점/)?.[1]);
    return { atBats: sum.atBats + atBats, hits: sum.hits + hits, rbi: sum.rbi + rbi };
  }, { atBats: 0, hits: 0, rbi: 0 });
  const pitcherList = pitcher.match(/<ul[^>]*class=["'][^"']*game_list[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? "";
  const pitchingGames = [...pitcherList.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => stripTags(match[1]));
  const pitchingTotal = pitchingGames.reduce((sum, game) => {
    const innings = game.match(/(\d+\s*[⅓⅔]?)이닝/)?.[1] ?? "0";
    return { pitchingOuts: sum.pitchingOuts + inningsToOuts(innings), hitsAllowed: sum.hitsAllowed + numberOf(game.match(/(\d+)피안타/)?.[1]), earnedRuns: sum.earnedRuns + numberOf(game.match(/(\d+)자책/)?.[1]) };
  }, { pitchingOuts: 0, hitsAllowed: 0, earnedRuns: 0 });
  const average = total.atBats ? total.hits / total.atBats : 0;
  const era = pitchingTotal.pitchingOuts ? pitchingTotal.earnedRuns * 21 / pitchingTotal.pitchingOuts : null;
  const batting: BattingStats = { games: games.length, atBats: total.atBats, average, hits: total.hits, homeRuns: null, rbi: total.rbi, ops: null, totalBases: 0, walks: 0, hitByPitch: 0, sacrificeFlies: 0 };
  const pitching: PitchingStats = { games: pitchingGames.length, era, wins: null, losses: null, saves: null, holds: null, innings: outsToInnings(pitchingTotal.pitchingOuts), pitchingOuts: pitchingTotal.pitchingOuts, hitsAllowed: pitchingTotal.hitsAllowed, walks: null, strikeouts: null, earnedRuns: pitchingTotal.earnedRuns, whip: null };
  return { games: gameIds.size || games.length, average, hits: total.hits, homeRuns: null, rbi: total.rbi, ops: null, era, atBats: total.atBats, batting, pitching };
}

function extractGameRefs(html: string, context: Omit<GameRef, "gameId" | "leagueId">): GameRef[] {
  const refs = [...html.matchAll(/\/league\/schedule\/all\?lig_idx=(\d+)&amp;game_idx=(\d+)|\/league\/schedule\/all\?lig_idx=(\d+)&game_idx=(\d+)/gi)]
    .map((match) => ({ ...context, leagueId: match[1] ?? match[3], gameId: match[2] ?? match[4] }));
  return [...new Map(refs.map((ref) => [ref.gameId, ref])).values()];
}

function tableRows(html: string, summary: "타자기록" | "투수기록") {
  return [...html.matchAll(new RegExp(`<table[^>]*summary=["']${summary}["'][^>]*>([\\s\\S]*?)<\\/table>`, "gi"))]
    .flatMap((table) => [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => row[1]));
}

function rowCells(row: string) {
  return [...row.matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((cell) => stripTags(cell[1]));
}

function findPlayerRow(html: string, summary: "타자기록" | "투수기록", groupCode: string) {
  return tableRows(html, summary).find((row) => row.includes(`group_code=${groupCode}`));
}

function parseBattingRow(row?: string): GameBatting | null {
  if (!row) return null;
  const cells = rowCells(row);
  if (cells.length < 8) return null;
  const totals = cells.slice(-7);
  const outcomes = cells.slice(1, -7).flatMap((cell) => cell.split(",").map((value) => value.trim()).filter(Boolean));
  const count = (pattern: RegExp) => outcomes.filter((outcome) => pattern.test(outcome)).length;
  const doubles = count(/(?:좌|우|중|좌중|우중|좌선|우선)2(?:$|\s)/);
  const triples = count(/(?:좌|우|중|좌중|우중|좌선|우선)3(?:$|\s)/);
  const homeRuns = count(/홈/);
  return {
    atBats: numberOf(totals[0]), hits: numberOf(totals[1]), rbi: numberOf(totals[2]), runs: numberOf(totals[3]), stolenBases: numberOf(totals[4]),
    doubles, triples, homeRuns, walks: count(/4구|고4/), hitByPitch: count(/사구/), sacrificeFlies: count(/희비/),
    sacrificeHits: count(/희타|희번/), strikeouts: count(/삼진/), doublePlays: count(/병살/),
  };
}

function parsePitchingRow(row?: string): GamePitching | null {
  if (!row) return null;
  const cells = rowCells(row);
  if (cells.length < 19) return null;
  return {
    result: cells[1], pitchingOuts: inningsToOuts(cells[2]), hitsAllowed: numberOf(cells[5]), homeRunsAllowed: numberOf(cells[6]),
    walks: numberOf(cells[9]), hitByPitch: numberOf(cells[10]), strikeouts: numberOf(cells[11]), runs: numberOf(cells[14]),
    earnedRuns: numberOf(cells[15]), pitches: numberOf(cells[16]),
  };
}

function parseBoxscore(html: string, ref: GameRef, groupCode: string): GameRecord {
  return { ...ref, batting: parseBattingRow(findPlayerRow(html, "타자기록", groupCode)), pitching: parsePitchingRow(findPlayerRow(html, "투수기록", groupCode)) };
}

function aggregateGames(games: GameRecord[]): TeamStats {
  const battingGames = games.filter((game) => game.batting);
  const pitchingGames = games.filter((game) => game.pitching && game.pitching.pitchingOuts > 0);
  const battingRaw = battingGames.reduce((sum, game) => {
    const value = game.batting!;
    return { atBats: sum.atBats + value.atBats, hits: sum.hits + value.hits, doubles: sum.doubles + value.doubles, triples: sum.triples + value.triples, homeRuns: sum.homeRuns + value.homeRuns, rbi: sum.rbi + value.rbi, walks: sum.walks + value.walks, hitByPitch: sum.hitByPitch + value.hitByPitch, sacrificeFlies: sum.sacrificeFlies + value.sacrificeFlies };
  }, { atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, rbi: 0, walks: 0, hitByPitch: 0, sacrificeFlies: 0 });
  const singles = Math.max(0, battingRaw.hits - battingRaw.doubles - battingRaw.triples - battingRaw.homeRuns);
  const totalBases = singles + battingRaw.doubles * 2 + battingRaw.triples * 3 + battingRaw.homeRuns * 4;
  const average = battingRaw.atBats ? battingRaw.hits / battingRaw.atBats : 0;
  const onBaseDenominator = battingRaw.atBats + battingRaw.walks + battingRaw.hitByPitch + battingRaw.sacrificeFlies;
  const onBase = onBaseDenominator ? (battingRaw.hits + battingRaw.walks + battingRaw.hitByPitch) / onBaseDenominator : 0;
  const slugging = battingRaw.atBats ? totalBases / battingRaw.atBats : 0;
  const pitchingRaw = pitchingGames.reduce((sum, game) => {
    const value = game.pitching!;
    return { pitchingOuts: sum.pitchingOuts + value.pitchingOuts, hitsAllowed: sum.hitsAllowed + value.hitsAllowed, walks: sum.walks + value.walks, strikeouts: sum.strikeouts + value.strikeouts, earnedRuns: sum.earnedRuns + value.earnedRuns, wins: sum.wins + (value.result === "승" ? 1 : 0), losses: sum.losses + (value.result === "패" ? 1 : 0), saves: sum.saves + (value.result === "세" ? 1 : 0), holds: sum.holds + (value.result === "홀" ? 1 : 0) };
  }, { pitchingOuts: 0, hitsAllowed: 0, walks: 0, strikeouts: 0, earnedRuns: 0, wins: 0, losses: 0, saves: 0, holds: 0 });
  const batting: BattingStats = { games: battingGames.length, atBats: battingRaw.atBats, average, hits: battingRaw.hits, homeRuns: battingRaw.homeRuns, rbi: battingRaw.rbi, ops: onBase + slugging, totalBases, walks: battingRaw.walks, hitByPitch: battingRaw.hitByPitch, sacrificeFlies: battingRaw.sacrificeFlies };
  const pitching: PitchingStats = { games: pitchingGames.length, era: pitchingRaw.pitchingOuts ? pitchingRaw.earnedRuns * 21 / pitchingRaw.pitchingOuts : null, wins: pitchingRaw.wins, losses: pitchingRaw.losses, saves: pitchingRaw.saves, holds: pitchingRaw.holds, innings: outsToInnings(pitchingRaw.pitchingOuts), pitchingOuts: pitchingRaw.pitchingOuts, hitsAllowed: pitchingRaw.hitsAllowed, walks: pitchingRaw.walks, strikeouts: pitchingRaw.strikeouts, earnedRuns: pitchingRaw.earnedRuns, whip: pitchingRaw.pitchingOuts ? (pitchingRaw.hitsAllowed + pitchingRaw.walks) * 3 / pitchingRaw.pitchingOuts : null };
  return { games: new Set(games.map((game) => game.gameId)).size, average, hits: battingRaw.hits, homeRuns: battingRaw.homeRuns, rbi: battingRaw.rbi, ops: onBase + slugging, era: pitching.era, atBats: battingRaw.atBats, batting, pitching };
}

function pageSection(html: string, start: string, end?: string) {
  const from = html.indexOf(start);
  if (from < 0) return "";
  const to = end ? html.indexOf(end, from + start.length) : -1;
  return html.slice(from, to > from ? to : undefined);
}

function extractName(html: string) {
  const profile = pageSection(html, "profile", "accordion");
  const candidates = [...profile.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/gi)].map((match) => stripTags(match[1]));
  return candidates.find((value) => /^[가-힣]{2,5}$/.test(value)) ?? "게임원 선수";
}

function extractTeam(html: string) {
  const match = html.match(/<ul[^>]*class=["']belong["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
  return match ? stripTags(match[1]) : "소속팀 미확인";
}

export async function POST(request: NextRequest) {
  try {
    const { url, season: requestedSeason, yearsOnly } = await request.json() as { url?: string; season?: number; yearsOnly?: boolean };
    if (!url) return NextResponse.json({ error: "게임원 선수 URL을 입력해주세요." }, { status: 400 });

    const target = new URL(url);
    if (!ALLOWED_HOSTS.has(target.hostname) || target.pathname !== PROFILE_PATH || !target.searchParams.get("group_code")) {
      return NextResponse.json({ error: "올바른 게임원 선수 기록 URL이 아닙니다." }, { status: 400 });
    }
    target.protocol = "https:";
    target.hostname = "gameone.kr";

    let requestQueue = Promise.resolve();
    let lastRequestAt = 0;
    const fetchPage = async (pageUrl: URL) => {
      let releaseQueue!: () => void;
      const previousRequest = requestQueue;
      requestQueue = new Promise<void>((resolve) => { releaseQueue = resolve; });
      await previousRequest;
      // 한 번에 하나씩만 요청하되 지나치게 긴 선수별 처리 시간을 피한다.
      const minimumDelay = 850 + Math.floor(Math.random() * 450);
      const waitFor = Math.max(0, lastRequestAt + minimumDelay - Date.now());
      if (waitFor) await new Promise((resolve) => setTimeout(resolve, waitFor));
      try {
        const response = await fetch(pageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
        lastRequestAt = Date.now();
        if (response.url.includes("service_block") || response.headers.get("content-type")?.startsWith("image/")) {
          throw new Error("GAMEONE_RATE_LIMIT: 게임원 요청 제한이 감지되었습니다. 잠시 후 다시 시도해주세요.");
        }
        if (!response.ok) throw new Error(`게임원 응답 오류 (${response.status})`);
        return response.text();
      } finally {
        releaseQueue();
      }
    };

    const html = await fetchPage(target);
    if (!html.includes("hitter_section")) throw new Error("공개 기록을 찾지 못했습니다.");
    const currentYear = new Date().getFullYear();
    const availableYears = [...html.matchAll(/<option\s+value=["'](\d{4})["']/gi)]
      .map((match) => Number(match[1])).filter((year) => year <= currentYear);
    const allYears = [...new Set(availableYears)].sort((a, b) => b - a);
    if (yearsOnly) {
      return NextResponse.json({ source: "GAMEONE", player: { name: extractName(html), team: extractTeam(html) }, years: allYears });
    }
    const years = requestedSeason ? allYears.filter((year) => year === requestedSeason) : allYears;
    const seasons: Array<{ season: number; stats: PublicStats }> = [];
    for (let index = 0; index < years.length; index += 4) {
      const batch = years.slice(index, index + 4);
      const results = await Promise.all(batch.map(async (season) => {
        const seasonUrl = new URL(target);
        seasonUrl.searchParams.set("season", String(season));
        seasonUrl.searchParams.set("game_type", "2");
        const seasonHtml = await fetchPage(seasonUrl);
        return { season, stats: parsePublicStats(seasonHtml) };
      }));
      seasons.push(...results.filter((item) => item.stats.games > 0));
    }
    if (!seasons.length) throw new Error("연도별 공식 기록을 찾지 못했습니다.");
    seasons.sort((a, b) => b.season - a.season);
    const gameRefs = new Map<string, GameRef>();
    const teamNames = new Map<string, string>();
    for (const seasonRecord of seasons) {
      const gameUrl = new URL("/locker/record/game", target.origin);
      gameUrl.searchParams.set("group_code", target.searchParams.get("group_code")!);
      gameUrl.searchParams.set("season", String(seasonRecord.season));
      gameUrl.searchParams.set("section", "0");
      const gameHtml = await fetchPage(gameUrl);
      const teamOptions = parseTeamOptions(gameHtml).flatMap((team) => {
        const selected = selectedTeam(team.name);
        return selected ? [{ ...team, name: selected.name }] : [];
      });
      for (let index = 0; index < teamOptions.length; index += 4) {
        const batch = teamOptions.slice(index, index + 4);
        const teamResults = await Promise.all(batch.map(async (team) => {
          const teamUrl = new URL(gameUrl);
          teamUrl.searchParams.set("club_idx", team.clubId);
          const teamHtml = await fetchPage(teamUrl);
          return { team, refs: extractGameRefs(teamHtml, { season: seasonRecord.season, clubId: team.clubId, teamName: team.name }) };
        }));
        for (const item of teamResults) {
          if (item.refs.length) teamNames.set(item.team.clubId, item.team.name);
          for (const ref of item.refs) gameRefs.set(ref.gameId, ref);
        }
      }
    }
    const rawGames: GameRecord[] = [];
    const refs = [...gameRefs.values()];
    for (let index = 0; index < refs.length; index += 4) {
      const batch = refs.slice(index, index + 4);
      const records = await Promise.all(batch.map(async (ref) => {
        const boxscoreUrl = new URL("/league/schedule/content/boxscore", target.origin);
        boxscoreUrl.searchParams.set("lig_idx", ref.leagueId);
        boxscoreUrl.searchParams.set("game_idx", ref.gameId);
        return parseBoxscore(await fetchPage(boxscoreUrl), ref, target.searchParams.get("group_code")!);
      }));
      rawGames.push(...records.filter((record) => record.batting || record.pitching));
    }
    if (!rawGames.length) throw new Error("썬볼 또는 RedPonies의 경기 기록을 찾지 못했습니다.");

    const teams = [...new Set(teamNames.values())].map((name) => {
      const teamGames = rawGames.filter((game) => game.teamName === name);
      const teamSeasons = [...new Set(teamGames.map((game) => game.season))].sort((a, b) => b - a)
        .map((season) => ({ season, stats: aggregateGames(teamGames.filter((game) => game.season === season)) }));
      return { clubId: selectedTeam(name)!.id, name, seasons: teamSeasons, career: aggregateGames(teamGames) };
    }).filter((team) => team.career.games > 0).sort((a, b) => b.career.games - a.career.games);
    const selectedSeasons = [...new Set(rawGames.map((game) => game.season))].sort((a, b) => b - a)
      .map((season) => ({ season, stats: aggregateGames(rawGames.filter((game) => game.season === season)) }));
    const career = aggregateGames(rawGames);

    return NextResponse.json({
      source: "GAMEONE",
      externalId: target.searchParams.get("group_code"),
      profileUrl: target.toString(),
      fetchedAt: new Date().toISOString(),
      player: { name: extractName(html), team: extractTeam(html) },
      currentSeason: selectedSeasons[0].season,
      stats: career,
      career,
      seasons: selectedSeasons,
      teams,
      games: rawGames,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "기록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
