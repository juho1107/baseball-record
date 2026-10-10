import { NextResponse } from "next/server";
import { getSourceSnapshot } from "../../lib/source-snapshots";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await getSourceSnapshot<Record<string, any>>("YAGOOS", "yagoos-snapshot.json");
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
