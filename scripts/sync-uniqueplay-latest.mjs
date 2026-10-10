import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { openUniquePlaySession } from "./uniqueplay-auth.mjs";

const API = "https://service-api.unique-play.com";
const outputFile = path.resolve(".data", "uniqueplay-latest-games.json");
const teams = [{ id: 2034, name: "썬볼" }, { id: 1208, name: "레드포니즈" }];

await mkdir(path.dirname(outputFile), { recursive: true });
const { context, token } = await openUniquePlaySession();

try {
  const results = [];
  for (const team of teams) {
    const today = new Date().toISOString().slice(0, 10);
    const url = `${API}/app-team/games?teamId=${team.id}&pageNo=1&pageSize=50&toDate=${today}&orderDir=DESC`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (!response.ok) throw new Error(`${team.name} 경기 조회 실패 (${response.status})`);
    const body = await response.json();
    const game = (body.items ?? []).filter((item) => item.recorded && item.date <= today).sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))[0];
    if (!game) throw new Error(`${team.name}의 완료된 경기를 찾지 못했습니다.`);
    const records = typeof game.records === "string" ? JSON.parse(game.records) : game.records;
    const first = game.batFirstTeamId === team.id;
    const teamScore = Number(first ? records.batFirstTeam.score : records.batLastTeam.score);
    const opponentScore = Number(first ? records.batLastTeam.score : records.batFirstTeam.score);
    results.push({
      team: team.name, source: `유니크플레이 · ${game.leagueName}`, sourceId: "uniqueplay",
      gameDate: new Date(`${game.date}T${game.time}+09:00`).toISOString(),
      opponent: first ? game.batLastTeamName : game.batFirstTeamName,
      teamScore, opponentScore,
      result: teamScore === opponentScore ? "무" : teamScore > opponentScore ? "승" : "패",
    });
  }
  await writeFile(outputFile, `${JSON.stringify({ fetchedAt: new Date().toISOString(), teams: results }, null, 2)}\n`, "utf8");
  console.log(`완료: ${outputFile}`);
} finally {
  await context.close();
}
