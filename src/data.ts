import raw from './data/seasons.json';

export type CategoryKey =
  | 'passTd'
  | 'passYd'
  | 'passInt'
  | 'rushYd'
  | 'rushTd'
  | 'recYd'
  | 'rec'
  | 'recTd'
  | 'fantasy'
  | 'sacks'
  | 'defInt'
  | 'fgMade';

export interface Category {
  key: CategoryKey;
  label: string;
  /** Lowercase noun used in sentences: "50 passing TDs". */
  unit: string;
  /** Top-N per season counted as recognizable enough for early rounds. */
  starN: number;
  /** Part of Mixed mode and the daily challenge (well-known stats only). */
  core: boolean;
}

export const CATEGORIES: Category[] = [
  { key: 'passTd', label: 'Passing TDs', unit: 'passing TDs', starN: 12, core: true },
  { key: 'passYd', label: 'Passing Yards', unit: 'passing yards', starN: 12, core: true },
  { key: 'passInt', label: 'Interceptions Thrown', unit: 'INTs thrown', starN: 12, core: true },
  { key: 'rushYd', label: 'Rushing Yards', unit: 'rushing yards', starN: 12, core: true },
  { key: 'rushTd', label: 'Rushing TDs', unit: 'rushing TDs', starN: 12, core: true },
  { key: 'recYd', label: 'Receiving Yards', unit: 'receiving yards', starN: 15, core: true },
  { key: 'rec', label: 'Receptions', unit: 'receptions', starN: 15, core: true },
  { key: 'recTd', label: 'Receiving TDs', unit: 'receiving TDs', starN: 15, core: true },
  { key: 'fantasy', label: 'Fantasy Points (PPR)', unit: 'PPR fantasy points', starN: 24, core: true },
  { key: 'sacks', label: 'Sacks', unit: 'sacks', starN: 12, core: true },
  { key: 'defInt', label: 'Interceptions', unit: 'interceptions', starN: 12, core: true },
  { key: 'fgMade', label: 'Field Goals Made', unit: 'field goals made', starN: 12, core: false },
];

export const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<
  CategoryKey,
  Category
>;

export type PositionKey = 'QB' | 'RB' | 'WR' | 'TE' | 'DEF' | 'K';

export interface Position {
  key: PositionKey;
  label: string;
  /** Data position groups this mode draws from. */
  groups: string[];
  categories: CategoryKey[];
  starN: number;
}

export const POSITIONS: Position[] = [
  { key: 'QB', label: 'Quarterbacks', groups: ['QB'], categories: ['passTd', 'passYd', 'passInt', 'rushYd', 'fantasy'], starN: 12 },
  { key: 'RB', label: 'Running Backs', groups: ['RB'], categories: ['rushYd', 'rushTd', 'rec', 'fantasy'], starN: 12 },
  { key: 'WR', label: 'Wide Receivers', groups: ['WR'], categories: ['recYd', 'rec', 'recTd', 'fantasy'], starN: 15 },
  { key: 'TE', label: 'Tight Ends', groups: ['TE'], categories: ['recYd', 'rec', 'recTd', 'fantasy'], starN: 6 },
  { key: 'DEF', label: 'Defense', groups: ['DL', 'LB', 'DB'], categories: ['sacks', 'defInt'], starN: 12 },
  { key: 'K', label: 'Kickers', groups: ['K'], categories: ['fgMade'], starN: 12 },
];

export const POSITION_BY_KEY = Object.fromEntries(POSITIONS.map((p) => [p.key, p])) as Record<
  PositionKey,
  Position
>;

/** One player-season's value in one category. */
export interface Entry {
  seasonId: number;
  player: string;
  team: string;
  year: number;
  /** Position group: QB, RB, WR, TE, DL, LB, DB, K. */
  pos: string;
  value: number;
}

export interface Pool {
  all: Entry[];
  /** Top-N per season by value: recognizable names for the early rounds. */
  stars: Entry[];
}

export interface RawData {
  source: string;
  range: [number, number];
  players: string[];
  teams: string[];
  positions: string[];
  seasons: [number, number, number, number][];
  stats: Record<CategoryKey, [number, number][]>;
}

export function formatValue(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function topPerSeason(entries: Entry[], n: number): Entry[] {
  const byYear = new Map<number, Entry[]>();
  for (const e of entries) {
    let list = byYear.get(e.year);
    if (!list) byYear.set(e.year, (list = []));
    list.push(e);
  }
  return [...byYear.values()].flatMap((list) => list.sort((a, b) => b.value - a.value).slice(0, n));
}

export class Dataset {
  readonly byCategory: Record<CategoryKey, Entry[]>;
  private readonly seasonCats = new Map<number, Map<CategoryKey, Entry>>();
  private readonly pools = new Map<string, Pool>();

  constructor(readonly raw: RawData) {
    const byCategory = {} as Record<CategoryKey, Entry[]>;
    for (const { key } of CATEGORIES) {
      byCategory[key] = raw.stats[key].map(([seasonId, value]) => {
        const [p, t, year, pos] = raw.seasons[seasonId];
        const entry: Entry = {
          seasonId,
          player: raw.players[p],
          team: raw.teams[t],
          year,
          pos: raw.positions[pos],
          value,
        };
        let cats = this.seasonCats.get(seasonId);
        if (!cats) this.seasonCats.set(seasonId, (cats = new Map()));
        cats.set(key, entry);
        return entry;
      });
    }
    this.byCategory = byCategory;
  }

  /** Entries for a category, optionally limited to one position mode; memoized. */
  pool(category: CategoryKey, position?: PositionKey): Pool {
    const id = `${category}:${position ?? ''}`;
    let pool = this.pools.get(id);
    if (!pool) {
      const pos = position ? POSITION_BY_KEY[position] : undefined;
      const all = pos ? this.byCategory[category].filter((e) => pos.groups.includes(e.pos)) : this.byCategory[category];
      const n = pos && pos.key !== 'DEF' ? pos.starN : CATEGORY_BY_KEY[category].starN;
      pool = { all, stars: topPerSeason(all, n) };
      this.pools.set(id, pool);
    }
    return pool;
  }

  /** Categories a given player-season qualifies in, each with its entry. */
  categoriesFor(seasonId: number): Map<CategoryKey, Entry> {
    return this.seasonCats.get(seasonId) ?? new Map();
  }
}

let cached: Dataset | undefined;
export function getDataset(): Dataset {
  return (cached ??= new Dataset(raw as RawData));
}
