import { describe, expect, it } from 'vitest';
import { CATEGORIES, getDataset, type CategoryKey, type Entry } from './data';
import { dailyRounds } from './daily';
import { ClassicRun, type Round } from './game';
import { mulberry32 } from './rng';

// Neither "always press Higher" nor "pick the more recent season" may beat a coin flip.
const ds = getDataset();

function rates(rounds: Round[], filter: (l: Entry, r: Entry) => boolean = () => true) {
  let higher = 0, newerWins = 0, cross = 0, n = 0;
  for (const { left, right } of rounds) {
    if (!filter(left, right)) continue;
    n++;
    if (right.value > left.value) higher++;
    if (left.year !== right.year) {
      cross++;
      const [older, newer] = left.year < right.year ? [left, right] : [right, left];
      if (newer.value > older.value) newerWins++;
    }
  }
  return { higher: higher / n, newerWins: newerWins / cross, n };
}

function classicRounds(mode: CategoryKey, runs = 150, length = 20): Round[] {
  const rng = mulberry32(99);
  const rounds: Round[] = [];
  for (let i = 0; i < runs; i++) {
    const run = new ClassicRun(ds, mode, rng);
    for (let s = 0; s < length; s++) {
      rounds.push(run.round);
      const { left, right } = run.round;
      run.guess(right.value >= left.value ? 'higher' : 'lower');
    }
  }
  return rounds;
}

describe('answer balance', () => {
  for (const { key } of CATEGORIES) {
    it(`${key}: Higher and "newer season wins" are both coin flips`, () => {
      const r = rates(classicRounds(key));
      expect(r.higher).toBeGreaterThan(0.45);
      expect(r.higher).toBeLessThan(0.55);
      expect(r.newerWins).toBeGreaterThan(0.45);
      expect(r.newerWins).toBeLessThan(0.55);
    });
  }

  it('pre-1999 vs post-1999 passing matchups do not favor the modern QB', () => {
    for (const key of ['passTd', 'passYd'] as const) {
      const r = rates(classicRounds(key, 300), (l, rt) => l.year < 1999 !== rt.year < 1999);
      expect(r.n).toBeGreaterThan(300);
      expect(r.newerWins).toBeGreaterThan(0.42);
      expect(r.newerWins).toBeLessThan(0.58);
    }
  });

  it('daily puzzles are balanced over a year', () => {
    const rounds: Round[] = [];
    for (let d = 0; d < 365; d++) rounds.push(...dailyRounds(ds, new Date(Date.UTC(2027, 0, 1 + d)).toISOString().slice(0, 10)));
    const r = rates(rounds);
    expect(r.higher).toBeGreaterThan(0.45);
    expect(r.higher).toBeLessThan(0.55);
    expect(r.newerWins).toBeGreaterThan(0.45);
    expect(r.newerWins).toBeLessThan(0.55);
  });
});
