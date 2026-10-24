import { readFile, writeFile, copyFile } from "node:fs/promises";

// Reuse stored boxscores; do not request frozen GameOne records again.
const file = ".data/gameone-snapshot.json";
const snapshot = JSON.parse(await readFile(file, "utf8"));
await copyFile(file, `${file}.before-batting-counts.bak`);
let completed = 0;
let incomplete = 0;
function fill(stats, games) {
  if (!stats?.batting) return;
  const rows = games.filter((game) => game.batting).map((game) => game.batting);
  for (const key of ["strikeouts", "stolenBases"]) {
    const complete = rows.length === stats.batting.games && rows.every((row) => Number.isFinite(row[key]));
    stats.batting[key] = complete ? rows.reduce((sum, row) => sum + row[key], 0) : null;
    if (complete) completed++; else incomplete++;
  }
}
for (const player of snapshot.players ?? []) {
  const record = player.record;
  if (!record) continue;
  const games = record.games ?? [];
  fill(record.career, games);
  fill(record.stats, games.filter((game) => game.season === record.currentSeason));
  for (const season of record.seasons ?? []) fill(season.stats, games.filter((game) => game.season === season.season));
  for (const team of record.teams ?? []) {
    const teamGames = games.filter((game) => game.teamName === team.name || (team.name === "레드포니즈" && game.teamName.toLowerCase() === "redponies"));
    fill(team.career, teamGames);
    for (const season of team.seasons ?? []) fill(season.stats, teamGames.filter((game) => game.season === season.season));
  }
}
await writeFile(file, JSON.stringify(snapshot, null, 2) + "\n");
console.log(JSON.stringify({ completed, incomplete }));
