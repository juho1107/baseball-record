import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { openUniquePlaySession } from "./uniqueplay-auth.mjs";

const API = "https://service-api.unique-play.com";
const LOGIN = "https://www.unique-play.com/login";
const outputFile = path.resolve(".data", "uniqueplay-snapshot.json");
const prompt = createInterface({ input, output });

async function api(token, pathname) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${API}${pathname}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!response.ok) {
      if (response.status >= 500 && attempt < 3) continue;
      throw new Error(`${pathname} 요청 실패 (${response.status})`);
    }
    const body = await response.text();
    if (!body.trim()) return {};
    try {
      return JSON.parse(body);
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
  return {};
}

function items(value) {
  return Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
}

function memberUid(member) {
  return member.uid ?? member.user?.uid ?? member.member?.uid ?? member.userId ?? null;
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
const { context, page, token } = await openUniquePlaySession();

try {
  const me = await api(token, "/app-user/me");
  const teams = items(await api(token, "/app-team/my-teams?pageSize=100"));
  if (!teams.length) throw new Error("관리 가능한 팀을 찾지 못했습니다.");

  const requestedNames = process.argv.slice(2);
  let selectedTeams;
  if (requestedNames.length) {
    selectedTeams = requestedNames.map((name) => teams.find((team) => team.name === name));
    const missing = requestedNames.filter((_, index) => !selectedTeams[index]);
    if (missing.length) throw new Error(`관리 팀에서 찾지 못함: ${missing.join(", ")}`);
  } else {
    console.log("\n가져올 팀을 선택하세요. 여러 팀은 쉼표로 구분할 수 있습니다.");
    teams.forEach((team, index) => console.log(`${index + 1}. ${team.name}`));
    const answer = await prompt.question("번호: ");
    selectedTeams = answer.split(",").map((value) => teams[Number(value.trim()) - 1]);
    if (selectedTeams.some((team) => !team)) throw new Error("올바른 팀 번호가 아닙니다.");
  }

  const importedTeams = [];
  for (const team of selectedTeams) {
    const membersResponse = await api(token, `/teams/${team.id}/members?pageSize=200`);
    const members = items(membersResponse).filter(memberUid);
    console.log(`\n${team.name} 팀원 ${members.length}명의 기록을 가져옵니다.`);

    const players = await mapLimited(members, 4, async (member, index) => {
      const uid = memberUid(member);
      const seasons = await api(token, `/app-user/my-seasons?uid=${encodeURIComponent(uid)}`).catch(() => []);
      const seasonList = items(seasons).map((item) => Number(item.year)).filter(Boolean);
      const seasonRecords = await mapLimited(seasonList, 3, async (season) => ({
        season,
        records: await api(token, `/games/records/by-user?uid=${encodeURIComponent(uid)}&teamId=${encodeURIComponent(team.id)}&seasonYear=${season}`),
      }));
      console.log(`[${index + 1}/${members.length}] ${member.name ?? member.user?.name ?? uid}`);
      return {
        uid,
        name: member.name ?? member.user?.name ?? "이름 미확인",
        memberId: member.id ?? null,
        seasons: items(seasons),
        seasonRecords,
      };
    });
    importedTeams.push({ id: team.id, name: team.name, players });
  }

  const snapshot = {
    schemaVersion: 1,
    source: "UNIQUEPLAY",
    fetchedAt: new Date().toISOString(),
    administrator: { uid: me.uid ?? null, name: me.name ?? null },
    teams: importedTeams,
  };
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  const playerCount = importedTeams.reduce((total, team) => total + team.players.length, 0);
  console.log(`\n완료: ${importedTeams.length}개 팀, ${playerCount}명의 기록을 ${outputFile}에 저장했습니다.`);
} finally {
  prompt.close();
  await context.close();
}
