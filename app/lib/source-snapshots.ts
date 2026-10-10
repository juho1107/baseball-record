import { readFile } from "node:fs/promises";
import path from "node:path";

type SnapshotRow<T> = { payload: T };

export async function getSourceSnapshot<T>(
  source: string,
  fallbackFileName: string,
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (apiUrl && publishableKey) {
    const response = await fetch(
      `${apiUrl}/rest/v1/source_snapshots?source=eq.${encodeURIComponent(source)}&select=payload&limit=1`,
      {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
        cache: "no-store",
      },
    );

    if (response.ok) {
      const rows = (await response.json()) as Array<SnapshotRow<T>>;
      if (rows[0]?.payload) return rows[0].payload;
    }
  }

  const contents = await readFile(
    path.resolve(".data", fallbackFileName),
    "utf8",
  );
  return JSON.parse(contents) as T;
}

