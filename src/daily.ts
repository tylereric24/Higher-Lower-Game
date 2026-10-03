import { CATEGORIES, type Dataset } from './data';
import { pickOpponent, randomStart, type Round } from './game';
import { hashString, mulberry32, shuffle } from './rng';

export const DAILY_ROUNDS = 10;
/** Puzzle #1. Change before launch so numbering starts at 1 on release day. */
export const DAILY_EPOCH = '2026-10-01';

/** Local calendar date, so the puzzle rolls over at the player's midnight. */
export function dateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function puzzleNumber(key: string): number {
  return dayNumber(key) - dayNumber(DAILY_EPOCH) + 1;
}

export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/**
 * Ten independent rounds, identical for every player on a given date: each category
 * twice in seeded order, difficulty ramping from easy to hard.
 */
export function dailyRounds(ds: Dataset, key: string): Round[] {
  const rng = mulberry32(hashString(`daily:${key}`));
  const cats = [...shuffle(rng, CATEGORIES), ...shuffle(rng, CATEGORIES)];
  const used = new Set<number>();
  return cats.slice(0, DAILY_ROUNDS).map(({ key: category }, i) => {
    let left = randomStart(ds, category, rng);
    while (used.has(left.seasonId)) left = randomStart(ds, category, rng);
    used.add(left.seasonId);
    const right = pickOpponent(ds, category, left, Math.round(i * 1.6), rng, used);
    used.add(right.seasonId);
    return { category, left, right };
  });
}

export function shareText(appName: string, key: string, results: boolean[]): string {
  const score = results.filter(Boolean).length;
  const grid = results.map((r) => (r ? '🟩' : '🟥')).join('');
  return `${appName} #${puzzleNumber(key)} ${score}/${results.length}\n${grid}`;
}
