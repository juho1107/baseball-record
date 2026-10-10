import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = JSON.parse(await readFile(path.resolve(".data", "yagoos-snapshot.json"), "utf8"));
    const fetchedAt = new Date(snapshot.fetchedAt);
    const nextSyncAt = new Date(fetchedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    return NextResponse.json({
      connected: true,
      fetchedAt: snapshot.fetchedAt,
      nextSyncAt: nextSyncAt.toISOString(),
      due: Date.now() >= nextSyncAt.getTime(),
      teams: snapshot.teams ?? [],
    });
  } catch {
    return NextResponse.json({ connected: false, due: true, teams: [] });
  }
}
