import { describe, expect, it } from 'vitest';
import { CATEGORIES, getDataset, type Entry } from './data';
import { ClassicRun, difficultyFor, isCorrect, pickOpponent, relativeGap, type Round } from './game';
import { mulberry32 } from './rng';

const ds = getDataset();
const entry = (value: number, player = 'X'): Entry => ({ seasonId: value, player, team: 'T', year: 2000, value, star: true });

describe('isCorrect', () => {
  const round = (l: number, r: number): Round => ({ category: 'passTd', left: entry(l, 'A'), right: entry(r, 'B') });
  it('scores higher and lower', () => {
    expect(isCorrect(round(20, 30), 'higher')).toBe(true);
    expect(isCorrect(round(20, 30), 'lower')).toBe(false);
    expect(isCorrect(round(30, 20), 'lower')).toBe(true);
    expect(isCorrect(round(30, 20), 'higher')).toBe(false);
  });
  it('treats ties as correct either way (the original game crashed on ties)', () => {
    expect(isCorrect(round(26, 26), 'higher')).toBe(true);
    expect(isCorrect(round(26, 26), 'lower')).toBe(true);
  });
});

describe('dataset', () => {
  it('has every category populated with stars', () => {
    for (const { key } of CATEGORIES) {
      expect(ds.byCategory[key].length).toBeGreaterThan(500);
      expect(ds.stars[key].length).toBeGreaterThan(200);
    }
  });
  it('carries known values, with corrections to the original data', () => {
    const find = (cat: 'passTd', player: string, year: number) =>
      ds.byCategory[cat].find((e) => e.player === player && e.year === year)?.value;
    expect(find('passTd', 'Tom Brady', 2007)).toBe(50);
    expect(find('passTd', 'Peyton Manning', 2013)).toBe(55);
    expect(find('passTd', 'Jake Plummer', 1999)).toBe(9);
    expect(find('passTd', 'Derek Carr', 2016)).toBe(28);
    expect(find('passTd', 'Dan Marino', 1986)).toBe(44);
  });
  it('uses era-correct team names', () => {
    const carr = ds.byCategory.passTd.find((e) => e.player === 'Derek Carr' && e.year === 2016);
    expect(carr?.team).toBe('Oakland Raiders');
  });
});

describe('pickOpponent', () => {
  it('respects the gap band, excludes same player, used seasons and equal values', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 500; i++) {
      const round = i % 20;
      const { key } = CATEGORIES[i % CATEGORIES.length];
      const left = ds.stars[key][i % ds.stars[key].length];
      const used = new Set([ds.byCategory[key][0].seasonId]);
      const right = pickOpponent(ds, key, left, round, rng, used);
      const d = difficultyFor(round);
      expect(right.player).not.toBe(left.player);
      expect(right.value).not.toBe(left.value);
      expect(used.has(right.seasonId)).toBe(false);
      // The band holds unless relaxed; relaxation keeps at least the floor in practice.
      expect(relativeGap(left.value, right.value)).toBeGreaterThanOrEqual(Math.min(d.minGap, 0.01));
    }
  });

  it('gets harder: average gap shrinks as the streak grows', () => {
    const rng = mulberry32(7);
    const avgGap = (round: number) => {
      let total = 0;
      for (let i = 0; i < 300; i++) {
        const left = ds.stars.passYd[i % ds.stars.passYd.length];
        total += relativeGap(left.value, pickOpponent(ds, 'passYd', left, round, rng).value);
      }
      return total / 300;
    };
    expect(avgGap(0)).toBeGreaterThan(avgGap(8));
    expect(avgGap(8)).toBeGreaterThan(avgGap(20));
  });
});

describe('ClassicRun', () => {
  it('chains: the revealed card becomes the next known card', () => {
    const run = new ClassicRun(ds, 'recYd', mulberry32(3));
    for (let i = 0; i < 40; i++) {
      const { left, right } = run.round;
      expect(run.guess(right.value >= left.value ? 'higher' : 'lower')).toBe(true);
      expect(run.round.left.seasonId).toBe(right.seasonId);
    }
    expect(run.streak).toBe(40);
  });

  it('never repeats a player-season within a run', () => {
    const run = new ClassicRun(ds, 'passTd', mulberry32(11));
    const seen = new Set([run.round.left.seasonId]);
    for (let i = 0; i < 100; i++) {
      const { left, right } = run.round;
      expect(seen.has(right.seasonId)).toBe(false);
      seen.add(right.seasonId);
      run.guess(right.value >= left.value ? 'higher' : 'lower');
    }
  });

  it('ends on a miss and allows a continue that keeps the streak', () => {
    const run = new ClassicRun(ds, 'mixed', mulberry32(5));
    const { left, right } = run.round;
    run.guess(right.value >= left.value ? 'higher' : 'lower');
    const r = run.round;
    expect(run.guess(r.right.value > r.left.value ? 'lower' : 'higher')).toBe(false);
    expect(run.over).toBe(true);
    expect(() => run.guess('higher')).toThrow();
    run.continueRun();
    expect(run.over).toBe(false);
    expect(run.streak).toBe(1);
    expect(run.round.left.seasonId).toBe(r.right.seasonId);
  });

  it('mixed mode always pairs values from the same category', () => {
    const run = new ClassicRun(ds, 'mixed', mulberry32(9));
    for (let i = 0; i < 60; i++) {
      const { category, left, right } = run.round;
      expect(ds.categoriesFor(left.seasonId).get(category)?.value).toBe(left.value);
      expect(ds.categoriesFor(right.seasonId).get(category)?.value).toBe(right.value);
      run.guess(right.value >= left.value ? 'higher' : 'lower');
    }
  });
});
