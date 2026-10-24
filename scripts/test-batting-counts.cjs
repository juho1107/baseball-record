const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync("app/record-utils.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = new Module("record-utils");
loaded._compile(compiled, "record-utils.cjs");
const { fromUniquePlay, combineStats, canonicalPlayerName, playerKey } = loaded.exports;
const first = fromUniquePlay({ hgame: 2, hso: 3, sb: 4, so: 99 });
const second = fromUniquePlay({ hgame: 1, hso: 0, sb: 2 });
assert.equal(first.batting.strikeouts, 3, "Must use batter strikeouts, not pitcher strikeouts");
assert.equal(combineStats([first, second]).batting.strikeouts, 3);
assert.equal(combineStats([first, second]).batting.stolenBases, 6);
assert.equal(combineStats([first, fromUniquePlay({ hgame: 1 })]).batting.strikeouts, null);
assert.equal(combineStats([first, fromUniquePlay({ hgame: 0 })]).batting.stolenBases, 4);
assert.equal(canonicalPlayerName("구정필(마스터)"), "구정필");
assert.equal(playerKey(" 구정필 (마스터) "), playerKey("구정필"));
assert.equal(canonicalPlayerName("다른선수(마스터)"), "다른선수(마스터)");
const snapshots = Object.fromEntries(["gameone", "uniqueplay", "yagoos", "nicecatch"].map((source) => [source, JSON.parse(fs.readFileSync(`.data/${source}-snapshot.json`, "utf8"))]));
const records = snapshots.gameone.players.flatMap((p) => p.record?.teams?.flatMap((t) => t.seasons.map((s) => s.stats)) ?? []);
for (const source of ["uniqueplay", "yagoos", "nicecatch"]) {
  records.push(...snapshots[source].teams.flatMap((t) => t.players.flatMap((p) => p.seasonRecords.map((s) => source === "uniqueplay" ? fromUniquePlay(s.records) : s.stats))));
}
for (const record of records.filter((r) => r.batting?.games > 0)) {
  for (const key of ["strikeouts", "stolenBases"]) assert.ok(Number.isInteger(record.batting[key]) && record.batting[key] >= 0, `${key} missing or invalid`);
}
const aliases = snapshots.nicecatch.teams.flatMap((t) => t.players).filter((p) => playerKey(p.name) === playerKey("구정필"));
assert.ok(aliases.length > 0);
console.log(`PASS: null handling, batter/pitcher distinction, alias normalization, ${records.length} stored season records`);
