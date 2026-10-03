import raw from './data/seasons.json';

export type CategoryKey = 'passTd' | 'passYd' | 'rushYd' | 'recYd' | 'rec';

export interface Category {
  key: CategoryKey;
  label: string;
  /** Lowercase noun used in sentences: "50 passing TDs". */
  unit: string;
}

export const CATEGORIES: Category[] = [
  { key: 'passTd', label: 'Passing TDs', unit: 'passing TDs' },
  { key: 'passYd', label: 'Passing Yards', unit: 'passing yards' },
  { key: 'rushYd', label: 'Rushing Yards', unit: 'rushing yards' },
  { key: 'recYd', label: 'Receiving Yards', unit: 'receiving yards' },
  { key: 'rec', label: 'Receptions', unit: 'receptions' },
];

export const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<
  CategoryKey,
  Category
>;

/** One player-season's value in one category. */
export interface Entry {
  seasonId: number;
  player: string;
  team: string;
  year: number;
  value: number;
  /** Top-N in the league that season: recognizable enough for early rounds. */
  star: boolean;
}

export interface RawData {
  source: string;
  range: [number, number];
  players: string[];
  teams: string[];
  seasons: [number, number, number][];
  stats: Record<CategoryKey, [number, number, number][]>;
}

export class Dataset {
  readonly byCategory: Record<CategoryKey, Entry[]>;
  readonly stars: Record<CategoryKey, Entry[]>;
  private readonly seasonCats = new Map<number, Map<CategoryKey, Entry>>();

  constructor(readonly raw: RawData) {
    const byCategory = {} as Record<CategoryKey, Entry[]>;
    const stars = {} as Record<CategoryKey, Entry[]>;
    for (const { key } of CATEGORIES) {
      byCategory[key] = raw.stats[key].map(([seasonId, value, star]) => {
        const [p, t, year] = raw.seasons[seasonId];
        const entry: Entry = {
          seasonId,
          player: raw.players[p],
          team: raw.teams[t],
          year,
          value,
          star: star === 1,
        };
        let cats = this.seasonCats.get(seasonId);
        if (!cats) this.seasonCats.set(seasonId, (cats = new Map()));
        cats.set(key, entry);
        return entry;
      });
      stars[key] = byCategory[key].filter((e) => e.star);
    }
    this.byCategory = byCategory;
    this.stars = stars;
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
