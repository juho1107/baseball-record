import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!apiUrl || !publishableKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required.");
}

const snapshots = [
  ["GAMEONE", "gameone-snapshot.json"],
  ["UNIQUEPLAY", "uniqueplay-snapshot.json"],
  ["YAGOOS", "yagoos-snapshot.json"],
  ["NICECATCH", "nicecatch-snapshot.json"],
  ["UNIQUEPLAY_LATEST", "uniqueplay-latest-games.json"],
  ["LATEST_GAMES", "latest-games.json"],
];

await mkdir(path.resolve(".data"), { recursive: true });

for (const [source, fileName] of snapshots) {
  const response = await fetch(
    `${apiUrl}/rest/v1/source_snapshots?source=eq.${source}&select=payload&limit=1`,
    { headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` } },
  );
  if (!response.ok) throw new Error(`${source} download failed (${response.status})`);
  const rows = await response.json();
  if (!rows[0]?.payload) throw new Error(`${source} snapshot is missing`);
  await writeFile(
    path.resolve(".data", fileName),
    `${JSON.stringify(rows[0].payload, null, 2)}\n`,
    "utf8",
  );
  console.log(`${source}: downloaded`);
}

