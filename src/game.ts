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

export interface PickOptions {
  /** Player-seasons already shown this run or puzzle. */
  used?: ReadonlySet<number>;
  /** Restrict to one position mode's pool. */
  position?: PositionKey;
  /** Force league leaders only (daily challenge), overriding the difficulty ramp. */
  starsOnly?: boolean;
  /** Players already shown; avoided unless the pool runs dry. */
  players?: ReadonlySet<string>;
}

/**
 * Choose the second card for a round. Constraints are relaxed in order (gap ceiling,
 * star pool, gap floor) so a pick always exists; it never returns the same player or
 * an equal value unless the dataset leaves no alternative.
 */
export function pickOpponent(
  ds: Dataset,
  category: CategoryKey,
  left: Entry,
  round: number,
  rng: Rng,
  opts: PickOptions = {},
): Entry {
  const d = difficultyFor(round);
  const used = opts.used ?? new Set<number>();
  const pool = ds.pool(category, opts.position);
  const starsOnly = opts.starsOnly ?? d.starsOnly;
  const players = opts.players ?? new Set<string>();
  const base = (stars: boolean) =>
    (stars ? pool.stars : pool.all).filter(
      (e) => e.player !== left.player && !used.has(e.seasonId) && !players.has(e.player) && e.value !== left.value,
    );
  const inBand = (entries: Entry[], min: number, max: number) =>
    entries.filter((e) => {
      const g = relativeGap(e.value, left.value);
      return g >= min && g <= max;
    });

  // Every attempt before `floorKept` respects the minimum gap for this round.
  const banded: (() => Entry[])[] = [
    () => inBand(base(starsOnly), d.minGap, d.maxGap),
    () => inBand(base(starsOnly), d.minGap, 1),
    ...(opts.starsOnly ? [] : [() => inBand(base(false), d.minGap, 1)]),
  ];
  const attempts: (() => Entry[])[] = [
    ...banded,
    () => base(starsOnly),
    ...(opts.starsOnly ? [] : [() => base(false)]),
    () => pool.all.filter((e) => e.seasonId !== left.seasonId),
  ];
  // Year must never be a tell: unbalanced, modern QBs out-threw pre-1999 QBs ~90% of
  // the time. Candidates are grouped by how many decades apart they are from the known
  // card. Only groups where both outcomes exist (some newer season higher, some lower)
  // are eligible; one is sampled at its natural rate, then a coin decides whether the
  // newer season wins. So within every era gap, "pick the recent year" is a coin flip.
  const wantNewerWins = rng() < 0.5;
  const decadesApart = (e: Entry) => Math.min(3, Math.floor(Math.abs(e.year - left.year) / 10));
  const newerWins = (e: Entry) => e.year > left.year === e.value > left.value;
  const balanced = (candidates: Entry[]) => {
    const cross = candidates.filter((e) => e.year !== left.year);
    const twoSided = new Set<number>();
    for (const bucket of [0, 1, 2, 3]) {
      const inBucket = cross.filter((e) => decadesApart(e) === bucket);
      if (inBucket.some(newerWins) && inBucket.some((e) => !newerWins(e))) twoSided.add(bucket);
    }
    const eligible = cross.filter((e) => twoSided.has(decadesApart(e)));
    if (!eligible.length) return [];
    const bucket = decadesApart(pick(rng, eligible));
    return eligible.filter((e) => decadesApart(e) === bucket && newerWins(e) === wantNewerWins);
  };

  // Prefer a balanced pick with a looser gap ceiling, or from beyond the league leaders,
  // over an unbalanced one; never trade away the gap floor for balance.
  for (const attempt of banded) {
    const candidates = balanced(attempt());
    if (candidates.length) return pick(rng, candidates);
  }
  for (const attempt of attempts) {
    const candidates = attempt();
    if (candidates.length) return pick(rng, candidates);
  }
  throw new Error(`no opponent available in ${category}`);
}

/**
 * A fresh pair. Both values are hidden from the player, so pairs never chain: a card
 * carried over from the last round would have its value already revealed.
 */
export function pickPair(ds: Dataset, category: CategoryKey, round: number, rng: Rng, opts: PickOptions = {}): Round {
  const used = opts.used ?? new Set<number>();
  const pool = ds.pool(category, opts.position);
  const starsOnly = opts.starsOnly ?? difficultyFor(round).starsOnly;
  const players = opts.players ?? new Set<string>();
  const fresh = (entries: Entry[]) => entries.filter((e) => !used.has(e.seasonId) && !players.has(e.player));
  const candidates = [fresh(starsOnly ? pool.stars : pool.all), fresh(pool.all), pool.all].find((c) => c.length)!;
  const first = pick(rng, candidates);
  const second = pickOpponent(ds, category, first, round, rng, { ...opts, used: new Set([...used, first.seasonId]) });
  // Both values are hidden, so the cards are interchangeable: a coin flip for which one
  // sits on top makes "always press Higher" exactly a 50% strategy. Without it, stats
  // with a hard qualifying floor (3+ INTs) made Higher right up to 76% of the time.
  return rng() < 0.5 ? { category, left: first, right: second } : { category, left: second, right: first };
}

/** Endless streak of independent pairs; difficulty ramps with the streak. */
export class ClassicRun {
  streak = 0;
  continuesUsed = 0;
  over = false;
  round: Round;
  private readonly used = new Set<number>();
  /** Recent players only: a long run would otherwise exhaust a position's pool. */
  private readonly recentPlayers: string[] = [];
  private readonly spec: ModeSpec;

  constructor(
    private readonly ds: Dataset,
    readonly mode: Mode,
    private readonly rng: Rng,
  ) {
    this.spec = modeSpec(mode);
    this.round = this.nextRound();
  }

  guess(g: Guess): boolean {
    if (this.over) throw new Error('run is over');
    const correct = isCorrect(this.round, g);
    if (correct) {
      this.streak++;
      this.round = this.nextRound();
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
    this.round = this.nextRound();
  }

  private nextRound(): Round {
    const category = pick(this.rng, this.spec.categories);
    const round = pickPair(this.ds, category, this.streak, this.rng, {
      used: this.used,
      position: this.spec.position,
      players: new Set(this.recentPlayers),
    });
    this.used.add(round.left.seasonId);
    this.used.add(round.right.seasonId);
    this.recentPlayers.push(round.left.player, round.right.player);
    this.recentPlayers.splice(0, this.recentPlayers.length - 20);
    return round;
  }
}
