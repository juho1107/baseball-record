import { readFile } from "node:fs/promises";
import path from "node:path";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!apiUrl || !secretKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
}

const snapshots = [
  ["GAMEONE", "gameone-snapshot.json"],
  ["UNIQUEPLAY", "uniqueplay-snapshot.json"],
  ["YAGOOS", "yagoos-snapshot.json"],
  ["NICECATCH", "nicecatch-snapshot.json"],
  ["UNIQUEPLAY_LATEST", "uniqueplay-latest-games.json"],
  ["LATEST_GAMES", "latest-games.json"],
];

const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  "Content-Type": "application/json",
};

function comparable(payload) {
  const copy = structuredClone(payload);
  delete copy.fetchedAt;
  return JSON.stringify(copy);
}

async function recordRun(source, changed, recordCount) {
  const response = await fetch(`${apiUrl}/rest/v1/sync_runs`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      source,
      status: "success",
      completed_at: new Date().toISOString(),
      details: { changed, recordCount },
    }),
  });
  if (!response.ok) throw new Error(`${source} sync history failed (${response.status})`);
}

function countRecords(source, payload) {
  if (source === "GAMEONE") {
    return (payload.players ?? []).filter((player) => player.record).length;
  }
  if (["UNIQUEPLAY", "YAGOOS", "NICECATCH"].includes(source)) {
    return (payload.teams ?? []).reduce(
      (total, team) => total + (team.players?.length ?? 0),
      0,
    );
  }
  return payload.sources?.length ?? payload.teams?.length ?? 0;
}

for (const [source, fileName] of snapshots) {
  const filePath = path.resolve(".data", fileName);
  const payload = JSON.parse(await readFile(filePath, "utf8"));
  const recordCount = countRecords(source, payload);
  const currentResponse = await fetch(
    `${apiUrl}/rest/v1/source_snapshots?source=eq.${source}&select=payload&limit=1`,
    { headers },
  );
  if (!currentResponse.ok) throw new Error(`${source} comparison failed (${currentResponse.status})`);
  const currentRows = await currentResponse.json();
  const changed = !currentRows[0]?.payload || comparable(currentRows[0].payload) !== comparable(payload);

  if (!changed) {
    await recordRun(source, false, recordCount);
    console.log(`${source}: unchanged (${recordCount} records)`);
    continue;
  }

  const response = await fetch(
    `${apiUrl}/rest/v1/source_snapshots?on_conflict=source`,
    {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        source,
        schema_version: payload.schemaVersion ?? 1,
        fetched_at: payload.fetchedAt ?? new Date().toISOString(),
        payload,
        record_count: recordCount,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${source} upload failed (${response.status}): ${message}`);
  }

  await recordRun(source, true, recordCount);
  console.log(`${source}: ${recordCount} records uploaded`);
}
