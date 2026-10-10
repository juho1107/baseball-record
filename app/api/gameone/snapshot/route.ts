import { NextResponse } from "next/server";
import { getSourceSnapshot } from "../../../lib/source-snapshots";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await getSourceSnapshot<Record<string, any>>("GAMEONE", "gameone-snapshot.json");
    const fetchedAt = new Date(snapshot.fetchedAt);
    const nextSyncAt = new Date(fetchedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    return NextResponse.json({
      connected: true,
      fetchedAt: snapshot.fetchedAt,
      nextSyncAt: nextSyncAt.toISOString(),
      due: Date.now() >= nextSyncAt.getTime(),
      teams: snapshot.teams?.map((team: { id: string; name: string }) => ({ id: team.id, name: team.name })),
      players: snapshot.players?.filter((player: { record?: unknown }) => player.record).map((player: { name: string; teams: string[]; record: unknown }) => ({ name: player.name, teams: player.teams, record: player.record })),
    });
  } catch {
    return NextResponse.json({ connected: false, due: true, teams: [], players: [] });
  }
}
