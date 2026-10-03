import {
  CATEGORIES,
  CATEGORY_BY_KEY,
  POSITION_BY_KEY,
  type CategoryKey,
  type Dataset,
  type Entry,
  type PositionKey,
} from './data';
import { pick, type Rng } from './rng';

export type Guess = 'higher' | 'lower';
/** Mixed (every core stat), a single stat, or one position's stats. */
export type Mode = 'mixed' | CategoryKey | PositionKey;

export interface ModeSpec {
  categories: CategoryKey[];
  position?: PositionKey;
}

export function modeSpec(mode: Mode): ModeSpec {
  if (mode === 'mixed') return { categories: CATEGORIES.filter((c) => c.core).map((c) => c.key) };
  if (mode in POSITION_BY_KEY) {
    const pos = POSITION_BY_KEY[mode as PositionKey];
    return { categories: pos.categories, position: pos.key };
  }
  return { categories: [mode as CategoryKey] };
}

export function modeLabel(mode: Mode): string {
  if (mode === 'mixed') return 'Mixed';
  return mode in POSITION_BY_KEY ? POSITION_BY_KEY[mode as PositionKey].label : CATEGORY_BY_KEY[mode as CategoryKey].label;
}

export interface Round {
  category: CategoryKey;
  /** Known card: value is shown. */
  left: Entry;
  /** Unknown card: the player guesses whether its value is higher or lower than left's. */
  right: Entry;
}

/** Ties count as correct either way: no player should lose a run to a coin flip. */
export function isCorrect(round: Round, guess: Guess): boolean {
  const { left, right } = round;
  if (right.value === left.value) return true;
  return guess === 'higher' ? right.value > left.value : right.value < left.value;
}

export function relativeGap(a: number, b: number): number {
  const hi = Math.max(a, b);
  return hi === 0 ? 0 : Math.abs(a - b) / hi;
}

export interface Difficulty {
  minGap: number;
  maxGap: number;
  starsOnly: boolean;
}

/**
 * Difficulty ramps with round number by narrowing the relative gap between the two
 * values and widening the pool from league leaders to every qualified season.
 */
export function difficultyFor(round: number): Difficulty {
  if (round < 3) return { minGap: 0.3, maxGap: 1, starsOnly: true };
  if (round < 6) return { minGap: 0.18, maxGap: 0.6, starsOnly: true };
  if (round < 10) return { minGap: 0.1, maxGap: 0.35, starsOnly: false };
  if (round < 15) return { minGap: 0.05, maxGap: 0.2, starsOnly: false };
  return { minGap: 0.01, maxGap: 0.12, starsOnly: false };
}

/**
 * Choose the unknown card for a round. Constraints are relaxed in order (gap ceiling,
 * star pool, gap floor) so a pick always exists; it never returns the same player or
 * an equal value unless the dataset leaves no alternative.
 */
export function pickOpponent(
  ds: Dataset,
  category: CategoryKey,
  left: Entry,
  round: number,
  rng: Rng,
  used: ReadonlySet<number> = new Set(),
  position?: PositionKey,
): Entry {
  const d = difficultyFor(round);
  const pool = ds.pool(category, position);
  const base = (starsOnly: boolean) =>
    (starsOnly ? pool.stars : pool.all).filter(
      (e) => e.player !== left.player && !used.has(e.seasonId) && e.value !== left.value,
    );
  const inBand = (pool: Entry[], min: number, max: number) =>
    pool.filter((e) => {
      const g = relativeGap(e.value, left.value);
      return g >= min && g <= max;
    });

  const attempts: (() => Entry[])[] = [
    () => inBand(base(d.starsOnly), d.minGap, d.maxGap),
    () => inBand(base(d.starsOnly), d.minGap, 1),
    () => inBand(base(false), d.minGap, 1),
    () => base(false),
    () => pool.all.filter((e) => e.seasonId !== left.seasonId),
  ];
  for (const attempt of attempts) {
    const candidates = attempt();
    if (candidates.length) return pick(rng, candidates);
  }
  throw new Error(`no opponent available in ${category}`);
}

export function randomStart(ds: Dataset, category: CategoryKey, rng: Rng, position?: PositionKey): Entry {
  return pick(rng, ds.pool(category, position).stars);
}

/** Endless chain: the revealed card becomes the known card for the next round. */
export class ClassicRun {
  streak = 0;
  continuesUsed = 0;
  over = false;
  round: Round;
  private readonly used = new Set<number>();
  private readonly spec: ModeSpec;

  constructor(
    private readonly ds: Dataset,
    readonly mode: Mode,
    private readonly rng: Rng,
  ) {
    this.spec = modeSpec(mode);
    const category = pick(rng, this.spec.categories);
    const left = randomStart(ds, category, rng, this.spec.position);
    this.used.add(left.seasonId);
    this.round = this.makeRound(category, left);
  }

  guess(g: Guess): boolean {
    if (this.over) throw new Error('run is over');
    const correct = isCorrect(this.round, g);
    if (correct) {
      this.streak++;
      this.advance();
    } else {
      this.over = true;
    }
    return correct;
  }

  /** Second chance after a wrong answer (rewarded ad). Streak is kept. */
  continueRun(): void {
    if (!this.over) throw new Error('run is not over');
    this.continuesUsed++;
    this.over = false;
    this.advance();
  }

  private advance(): void {
    const left = this.round.right;
    let category = this.round.category;
    if (this.spec.categories.length > 1) {
      // Switch to any stat in this mode that the revealed season also qualifies in.
      const options = [...this.ds.categoriesFor(left.seasonId).keys()].filter((c) => this.spec.categories.includes(c));
      category = pick(this.rng, options);
    }
    const leftEntry = this.ds.categoriesFor(left.seasonId).get(category) ?? left;
    this.round = this.makeRound(category, leftEntry);
  }

  private makeRound(category: CategoryKey, left: Entry): Round {
    const right = pickOpponent(this.ds, category, left, this.streak, this.rng, this.used, this.spec.position);
    this.used.add(right.seasonId);
    return { category, left, right };
  }
}
