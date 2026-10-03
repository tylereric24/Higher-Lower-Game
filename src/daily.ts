import { CATEGORIES, type Dataset } from './data';
import { pickPair, type Round } from './game';
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
 * Ten rounds, identical for every player on a given date. Each uses a different core
 * stat in seeded order. Both players always come from that season's league leaders, so
 * a shared puzzle never hinges on an obscure name; difficulty ramps through the gap
 * between their values instead.
 */
export function dailyRounds(ds: Dataset, key: string): Round[] {
  const rng = mulberry32(hashString(`daily:${key}`));
  const cats = shuffle(rng, CATEGORIES.filter((c) => c.core));
  const used = new Set<number>();
  const players = new Set<string>();
  return cats.slice(0, DAILY_ROUNDS).map(({ key: category }, i) => {
    const round = pickPair(ds, category, Math.round(i * 1.7), rng, { used, players, starsOnly: true });
    used.add(round.left.seasonId).add(round.right.seasonId);
    players.add(round.left.player).add(round.right.player);
    return round;
  });
}

export function shareText(appName: string, key: string, results: boolean[]): string {
  const score = results.filter(Boolean).length;
  const grid = results.map((r) => (r ? '🟩' : '🟥')).join('');
  return `${appName} #${puzzleNumber(key)} ${score}/${results.length}\n${grid}`;
}
