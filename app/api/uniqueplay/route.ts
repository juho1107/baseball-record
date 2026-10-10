import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const contents = await readFile(path.resolve(".data", "uniqueplay-snapshot.json"), "utf8");
    const snapshot = JSON.parse(contents);
    const fetchedAt = new Date(snapshot.fetchedAt);
    const nextSyncAt = new Date(fetchedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const teams = (snapshot.teams ?? []).map((team: { id: number; name: string; players?: Array<Record<string, unknown>> }) => ({
      id: team.id,
      name: team.name,
      players: (team.players ?? []).map(({ name, seasonRecords }) => ({ name, seasonRecords })),
    }));
    return NextResponse.json({
      connected: true,
      due: Date.now() >= nextSyncAt.getTime(),
      nextSyncAt: nextSyncAt.toISOString(),
      schemaVersion: snapshot.schemaVersion,
      source: snapshot.source,
      fetchedAt: snapshot.fetchedAt,
      teams,
    });
  } catch {
    return NextResponse.json({ connected: false, due: true });
  }
}
