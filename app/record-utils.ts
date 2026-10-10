export type BattingRecord = {
  games: number; atBats: number; average: number; hits: number; homeRuns: number | null; rbi: number; ops: number | null;
  totalBases?: number; walks?: number; hitByPitch?: number; sacrificeFlies?: number;
};

export type PitchingRecord = {
  games: number; era: number | null; wins: number | null; losses: number | null; innings: string; strikeouts: number | null; whip: number | null;
  pitchingOuts?: number; hitsAllowed?: number; walks?: number | null; earnedRuns?: number;
};

export type RecordStats = {
  games: number; average: number; hits: number; homeRuns: number | null; rbi: number; ops: number | null; era: number | null;
  batting?: BattingRecord; pitching?: PitchingRecord;
};

export type UniquePlayRaw = Record<string, string | number | null | undefined>;

const numeric = (value: unknown) => Number(value) || 0;

export function inningsToOuts(value: unknown) {
  const [whole, fraction = "0"] = String(value ?? 0).split(".");
  return numeric(whole) * 3 + Math.min(numeric(fraction), 2);
}

export function outsToInnings(outs: number) {
  return `${Math.floor(outs / 3)}${outs % 3 ? `.${outs % 3}` : ""}`;
}

export function fromUniquePlay(raw: UniquePlayRaw = {}): RecordStats {
  const atBats = numeric(raw.hab);
  const hits = numeric(raw.h);
  const totalBases = numeric(raw.totalBaseHit) || numeric(raw.h1) + numeric(raw.h2) * 2 + numeric(raw.h3) * 3 + numeric(raw.hr) * 4;
  const walks = numeric(raw.hbb) + numeric(raw.hibb);
  const hitByPitch = numeric(raw.hhitByPitch);
  const sacrificeFlies = numeric(raw.hsacf);
  const obpDenominator = atBats + walks + hitByPitch + sacrificeFlies;
  const average = atBats ? hits / atBats : 0;
  const ops = atBats || obpDenominator ? totalBases / Math.max(atBats, 1) + (hits + walks + hitByPitch) / Math.max(obpDenominator, 1) : 0;
  const pitchingOuts = inningsToOuts(raw.innings);
  const hitsAllowed = numeric(raw.ph);
  const pitchingWalks = numeric(raw.pbb) + numeric(raw.pibb);
  const earnedRuns = numeric(raw.er);
  const era = pitchingOuts ? earnedRuns * 21 / pitchingOuts : null;
  const whip = pitchingOuts ? (hitsAllowed + pitchingWalks) * 3 / pitchingOuts : null;
  const batting: BattingRecord = { games: numeric(raw.hgame), atBats, average, hits, homeRuns: numeric(raw.hr), rbi: numeric(raw.rbi), ops, totalBases, walks, hitByPitch, sacrificeFlies };
  const pitching: PitchingRecord = { games: numeric(raw.pgame), era, wins: numeric(raw.win), losses: numeric(raw.lose), innings: outsToInnings(pitchingOuts), strikeouts: numeric(raw.so), whip, pitchingOuts, hitsAllowed, walks: pitchingWalks, earnedRuns };
  return { games: Math.max(batting.games, pitching.games), average, hits, homeRuns: batting.homeRuns, rbi: batting.rbi, ops, era, batting, pitching };
}

export function combineStats(values: Array<RecordStats | undefined>): RecordStats | undefined {
  const records = values.filter(Boolean) as RecordStats[];
  if (!records.length) return undefined;
  const battingValues = records.map((record) => record.batting).filter(Boolean) as BattingRecord[];
  const pitchingValues = records.map((record) => record.pitching).filter(Boolean) as PitchingRecord[];
  const battingRaw = battingValues.reduce((sum, value) => ({
    games: sum.games + value.games, atBats: sum.atBats + value.atBats, hits: sum.hits + value.hits,
    homeRuns: sum.homeRuns + (value.homeRuns ?? 0), rbi: sum.rbi + value.rbi,
    totalBases: sum.totalBases + (value.totalBases ?? 0), walks: sum.walks + (value.walks ?? 0),
    hitByPitch: sum.hitByPitch + (value.hitByPitch ?? 0), sacrificeFlies: sum.sacrificeFlies + (value.sacrificeFlies ?? 0),
  }), { games: 0, atBats: 0, hits: 0, homeRuns: 0, rbi: 0, totalBases: 0, walks: 0, hitByPitch: 0, sacrificeFlies: 0 });
  const average = battingRaw.atBats ? battingRaw.hits / battingRaw.atBats : 0;
  const obpDenominator = battingRaw.atBats + battingRaw.walks + battingRaw.hitByPitch + battingRaw.sacrificeFlies;
  const ops = battingRaw.atBats || obpDenominator
    ? battingRaw.totalBases / Math.max(battingRaw.atBats, 1) + (battingRaw.hits + battingRaw.walks + battingRaw.hitByPitch) / Math.max(obpDenominator, 1)
    : 0;
  const pitchingRaw = pitchingValues.reduce((sum, value) => ({
    games: sum.games + value.games, wins: sum.wins + (value.wins ?? 0), losses: sum.losses + (value.losses ?? 0),
    pitchingOuts: sum.pitchingOuts + (value.pitchingOuts ?? inningsToOuts(value.innings)), hitsAllowed: sum.hitsAllowed + (value.hitsAllowed ?? 0),
    walks: sum.walks + (value.walks ?? 0), strikeouts: sum.strikeouts + (value.strikeouts ?? 0), earnedRuns: sum.earnedRuns + (value.earnedRuns ?? 0),
  }), { games: 0, wins: 0, losses: 0, pitchingOuts: 0, hitsAllowed: 0, walks: 0, strikeouts: 0, earnedRuns: 0 });
  const era = pitchingRaw.pitchingOuts ? pitchingRaw.earnedRuns * 21 / pitchingRaw.pitchingOuts : null;
  const whip = pitchingRaw.pitchingOuts ? (pitchingRaw.hitsAllowed + pitchingRaw.walks) * 3 / pitchingRaw.pitchingOuts : null;
  const batting: BattingRecord = { ...battingRaw, average, ops };
  const pitching: PitchingRecord = { ...pitchingRaw, era, innings: outsToInnings(pitchingRaw.pitchingOuts), whip };
  return { games: Math.max(batting.games, pitching.games), average, hits: batting.hits, homeRuns: batting.homeRuns, rbi: batting.rbi, ops, era, batting, pitching };
}
