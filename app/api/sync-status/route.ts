import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Snapshot = { fetchedAt?: string };
type LatestGames = { teams?: unknown[] };

async function readJson<T>(fileName: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.resolve(".data", fileName), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function GET() {
  const [gameone, uniqueplay, yagoos, nicecatch, latestGames] = await Promise.all([
    readJson<Snapshot>("gameone-snapshot.json"),
    readJson<Snapshot>("uniqueplay-snapshot.json"),
    readJson<Snapshot>("yagoos-snapshot.json"),
    readJson<Snapshot>("nicecatch-snapshot.json"),
    readJson<LatestGames>("latest-games.json"),
  ]);

  const newest = (values: Array<string | undefined>) =>
    values.filter(Boolean).sort((a, b) => Date.parse(b!) - Date.parse(a!))[0] ?? null;

  const syncedAt = {
    "썬볼": newest([gameone?.fetchedAt, uniqueplay?.fetchedAt, yagoos?.fetchedAt, nicecatch?.fetchedAt]),
    "레드포니즈": newest([gameone?.fetchedAt, uniqueplay?.fetchedAt]),
  };

  const teams = (latestGames?.teams ?? []).map((team) => {
    const value = team as { team?: string };
    return { ...value, syncedAt: syncedAt[value.team as keyof typeof syncedAt] ?? null };
  });

  return NextResponse.json({ teams });
}
