import { NextResponse } from "next/server";
import { getSourceSnapshot } from "../../lib/source-snapshots";

export const runtime = "nodejs";

type Snapshot = { fetchedAt?: string };
type LatestGame = { team?: string; [key: string]: unknown };
type LatestGames = { teams?: LatestGame[] };

export async function GET() {
  const [gameone, uniqueplay, yagoos, nicecatch, latestGames] =
    await Promise.all([
      getSourceSnapshot<Snapshot>("GAMEONE", "gameone-snapshot.json").catch(() => null),
      getSourceSnapshot<Snapshot>("UNIQUEPLAY", "uniqueplay-snapshot.json").catch(() => null),
      getSourceSnapshot<Snapshot>("YAGOOS", "yagoos-snapshot.json").catch(() => null),
      getSourceSnapshot<Snapshot>("NICECATCH", "nicecatch-snapshot.json").catch(() => null),
      getSourceSnapshot<LatestGames>("LATEST_GAMES", "latest-games.json").catch(() => null),
    ]);

  const newest = (values: Array<string | undefined>) =>
    values
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;

  const syncedAt: Record<string, string | null> = {
    썬볼: newest([
      gameone?.fetchedAt,
      uniqueplay?.fetchedAt,
      yagoos?.fetchedAt,
      nicecatch?.fetchedAt,
    ]),
    레드포니즈: newest([gameone?.fetchedAt, uniqueplay?.fetchedAt]),
  };

  const teams = (latestGames?.teams ?? []).map((team) => ({
    ...team,
    syncedAt: syncedAt[team.team ?? ""] ?? null,
  }));

  return NextResponse.json({ teams });
}

