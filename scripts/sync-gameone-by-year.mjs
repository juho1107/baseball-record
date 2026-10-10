import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const APP_API = process.env.DUGOUT_URL ?? "http://127.0.0.1:3000";
const outputFile = path.resolve(".data", "gameone-snapshot.json");
const targetCodes = new Set(process.argv.slice(2));
if (!targetCodes.size) throw new Error("재수집할 group code를 하나 이상 입력하세요.");

const number = (value) => Number(value) || 0;
const inningsToOuts = (value) => {
  const [whole, fraction = "0"] = String(value ?? 0).split(".");
  return number(whole) * 3 + Math.min(number(fraction), 2);
};
const outsToInnings = (outs) => `${Math.floor(outs / 3)}${outs % 3 ? `.${outs % 3}` : ""}`;

function combineStats(values) {
  if (!values.length) return null;
  const batting = values.reduce((sum, stats) => {
    const value = stats.batting ?? {};
    sum.games += number(value.games); sum.atBats += number(value.atBats); sum.hits += number(value.hits);
    sum.homeRuns += number(value.homeRuns); sum.rbi += number(value.rbi); sum.totalBases += number(value.totalBases);
    sum.walks += number(value.walks); sum.hitByPitch += number(value.hitByPitch); sum.sacrificeFlies += number(value.sacrificeFlies);
    return sum;
  }, { games: 0, atBats: 0, hits: 0, homeRuns: 0, rbi: 0, totalBases: 0, walks: 0, hitByPitch: 0, sacrificeFlies: 0 });
  const pitching = values.reduce((sum, stats) => {
    const value = stats.pitching ?? {};
    sum.games += number(value.games); sum.wins += number(value.wins); sum.losses += number(value.losses);
    sum.saves += number(value.saves); sum.holds += number(value.holds); sum.pitchingOuts += number(value.pitchingOuts) || inningsToOuts(value.innings);
    sum.hitsAllowed += number(value.hitsAllowed); sum.walks += number(value.walks); sum.strikeouts += number(value.strikeouts); sum.earnedRuns += number(value.earnedRuns);
    return sum;
  }, { games: 0, wins: 0, losses: 0, saves: 0, holds: 0, pitchingOuts: 0, hitsAllowed: 0, walks: 0, strikeouts: 0, earnedRuns: 0 });
  const average = batting.atBats ? batting.hits / batting.atBats : 0;
  const obpDenominator = batting.atBats + batting.walks + batting.hitByPitch + batting.sacrificeFlies;
  const ops = batting.atBats || obpDenominator
    ? batting.totalBases / Math.max(batting.atBats, 1) + (batting.hits + batting.walks + batting.hitByPitch) / Math.max(obpDenominator, 1) : 0;
  const era = pitching.pitchingOuts ? pitching.earnedRuns * 21 / pitching.pitchingOuts : null;
  const whip = pitching.pitchingOuts ? (pitching.hitsAllowed + pitching.walks) * 3 / pitching.pitchingOuts : null;
  const battingRecord = { ...batting, average, ops };
  const pitchingRecord = { ...pitching, innings: outsToInnings(pitching.pitchingOuts), era, whip };
  return { games: Math.max(batting.games, pitching.games), average, hits: batting.hits, homeRuns: batting.homeRuns, rbi: batting.rbi, ops, era, batting: battingRecord, pitching: pitchingRecord };
}

async function post(groupCode, extra, timeout = 6 * 60_000) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${APP_API}/api/gameone`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://gameone.kr/locker/record/sum?group_code=${groupCode}`, ...extra }),
        signal: AbortSignal.timeout(timeout),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `게임원 응답 오류 (${response.status})`);
      return body;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /fetch failed|timeout|aborted|network|ECONN/i.test(message);
      if (!retryable || attempt === 3) throw error;
      console.log(`  재시도 ${attempt}/2 · ${attempt * 30}초 대기`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 30_000));
    }
  }
  throw lastError;
}

function mergedRecord(checkpoints) {
  const records = checkpoints.filter((item) => item.record).map((item) => item.record);
  const seasons = records.flatMap((record) => record.seasons ?? []).sort((a, b) => b.season - a.season);
  const teamNames = [...new Set(records.flatMap((record) => (record.teams ?? []).map((team) => team.name)))];
  const teams = teamNames.map((name) => {
    const fragments = records.flatMap((record) => record.teams ?? []).filter((team) => team.name === name);
    const teamSeasons = fragments.flatMap((team) => team.seasons ?? []).sort((a, b) => b.season - a.season);
    return { clubId: fragments[0].clubId, name, seasons: teamSeasons, career: combineStats(teamSeasons.map((item) => item.stats)) };
  });
  const career = combineStats(seasons.map((item) => item.stats));
  const first = records[0];
  return { ...first, fetchedAt: new Date().toISOString(), currentSeason: seasons[0]?.season, stats: career, career, seasons, teams, games: records.flatMap((record) => record.games ?? []) };
}

const snapshot = JSON.parse(await readFile(outputFile, "utf8"));
async function save() {
  snapshot.fetchedAt = new Date().toISOString();
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

for (const player of snapshot.players) {
  if (!targetCodes.has(player.groupCode)) continue;
  const info = await post(player.groupCode, { yearsOnly: true }, 60_000);
  player.name = info.player.name;
  const checkpoints = player.yearCheckpoints ?? [];
  player.yearCheckpoints = checkpoints;
  console.log(`\n${player.name}: ${info.years.length}개 연도 확인`);
  for (const season of info.years) {
    if (checkpoints.some((item) => item.season === season)) {
      console.log(`  ${season}: 저장됨, 건너뜀`);
      continue;
    }
    try {
      const record = await post(player.groupCode, { season });
      checkpoints.push({ season, record });
      player.record = mergedRecord(checkpoints);
      delete player.error;
      console.log(`  ${season}: 완료 (${record.stats.games}경기)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/경기 기록을 찾지 못|연도별 공식 기록을 찾지 못/.test(message)) {
        checkpoints.push({ season, empty: true });
        console.log(`  ${season}: 대상 팀 기록 없음`);
      } else {
        player.error = `${season}: ${message}`;
        console.log(`  ${season}: 실패 - ${message}`);
      }
    }
    await save();
    await new Promise((resolve) => setTimeout(resolve, 12_000));
  }
  if (checkpoints.some((item) => item.record)) player.record = mergedRecord(checkpoints);
  await save();
}

console.log("\n연도별 재수집 작업 완료");
