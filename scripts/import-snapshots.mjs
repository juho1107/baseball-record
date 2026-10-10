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
  const response = await fetch(
    `${apiUrl}/rest/v1/source_snapshots?on_conflict=source`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
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

  console.log(`${source}: ${recordCount} records uploaded`);
}

