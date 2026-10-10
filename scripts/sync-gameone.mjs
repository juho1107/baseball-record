import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const APP_API = process.env.DUGOUT_URL ?? "http://127.0.0.1:3000";
const requestedCodes = new Set(process.argv.slice(2));
const outputFile = path.resolve(".data", "gameone-snapshot.json");
const teams = [
  { id: "4901", sourceName: "썬볼", name: "썬볼" },
  { id: "15680", sourceName: "RedPonies", name: "레드포니즈" },
];

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/131.0", "Accept-Language": "ko-KR,ko;q=0.9" }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${url} 요청 실패 (${response.status})`);
  return response.text();
}

async function syncPlayer(groupCode) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${APP_API}/api/gameone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://gameone.kr/locker/record/sum?group_code=${groupCode}` }),
        signal: AbortSignal.timeout(requestedCodes.size ? 20 * 60_000 : 5 * 60_000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `게임원 동기화 실패 (${response.status})`);
      return body;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /fetch failed|timeout|aborted|network|ECONN/i.test(message);
      if (!retryable || attempt === 3) throw error;
      const delay = 30_000 * attempt;
      console.log(`  네트워크 오류 재시도 ${attempt}/2 · ${delay / 1000}초 대기`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function mapLimited(values, limit, worker) {
  const result = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      result[index] = await worker(values[index], index);
    }
  }));
  return result;
}

await mkdir(path.dirname(outputFile), { recursive: true });
const previous = await readFile(outputFile, "utf8").then(JSON.parse).catch(() => ({ players: [] }));
const members = new Map();
if (process.env.GAMEONE_REUSE_ROSTER === "1" && previous.players?.length >= 60) {
  for (const player of previous.players) members.set(player.groupCode, { groupCode: player.groupCode, teams: player.teams });
  console.log(`저장된 선수 명단 ${members.size}명을 사용합니다.`);
} else {
  for (const team of teams) {
    const html = await fetchText(`https://gameone.kr/club/info/player?club_idx=${team.id}`);
    const codes = [...html.matchAll(/\/locker\/\?group_code=([A-Za-z0-9]+)/g)].map((match) => match[1]);
    for (const groupCode of new Set(codes)) {
      const member = members.get(groupCode) ?? { groupCode, teams: [] };
      member.teams.push(team.name);
      members.set(groupCode, member);
    }
    console.log(`${team.name}: 선수 코드 ${new Set(codes).size}개 확인`);
  }
}

const list = [...members.values()];
const previousByCode = new Map((previous.players ?? []).filter((player) => player.record).map((player) => [player.groupCode, player]));
const previousAllByCode = new Map((previous.players ?? []).map((player) => [player.groupCode, player]));
const players = list.map((member) => ({ ...(previousAllByCode.get(member.groupCode) ?? member), teams: member.teams }));
let rateLimited = false;
async function saveProgress() {
  const snapshot = { schemaVersion: 1, source: "GAMEONE", fetchedAt: new Date().toISOString(), teams, players };
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}
await saveProgress();
for (let index = 0; index < list.length; index += 1) {
  const member = list[index];
  if (requestedCodes.size && !requestedCodes.has(member.groupCode)) continue;
  const cached = previousByCode.get(member.groupCode);
  if (cached) {
    players[index] = { ...cached, teams: member.teams };
    console.log(`[${index + 1}/${list.length}] ${cached.name} 기존 기록 사용`);
    continue;
  }
  if (rateLimited) {
    players[index] = { ...member, name: "이름 미확인", error: "요청 제한으로 다음 실행에서 재시도" };
    continue;
  }
  try {
    const record = await syncPlayer(member.groupCode);
    console.log(`[${index + 1}/${list.length}] ${record.player.name} 완료`);
    players[index] = { ...member, name: record.player.name, record };
    await saveProgress();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[${index + 1}/${list.length}] 실패: ${message}`);
    players[index] = { ...member, name: "이름 미확인", error: message };
    await saveProgress();
    if (message.includes("GAMEONE_RATE_LIMIT")) rateLimited = true;
  }
  if (!rateLimited) {
    const delay = 12000 + Math.floor(Math.random() * 6000);
    console.log(`다음 선수까지 ${Math.ceil(delay / 1000)}초 대기`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

const snapshot = { schemaVersion: 1, source: "GAMEONE", fetchedAt: new Date().toISOString(), teams, players };
await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`완료: ${players.filter((player) => player.record).length}/${players.length}명의 기록 저장`);
