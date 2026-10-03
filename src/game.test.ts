import { describe, expect, it } from 'vitest';
import { CATEGORIES, getDataset, POSITION_BY_KEY, POSITIONS, type CategoryKey, type Entry } from './data';
import { ClassicRun, difficultyFor, isCorrect, modeSpec, pickOpponent, relativeGap, type Round } from './game';
import { mulberry32 } from './rng';

const ds = getDataset();
const entry = (value: number, player = 'X'): Entry => ({ seasonId: value, player, team: 'T', year: 2000, pos: 'QB', value });
const find = (cat: CategoryKey, player: string, year: number) =>
  ds.byCategory[cat].find((e) => e.player === player && e.year === year)?.value;

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
      expect(ds.byCategory[key].length).toBeGreaterThan(800);
      expect(ds.pool(key).stars.length).toBeGreaterThan(250);
    }
  });
  it('carries known values, with corrections to the original data', () => {
    expect(find('passTd', 'Tom Brady', 2007)).toBe(50);
    expect(find('passTd', 'Peyton Manning', 2013)).toBe(55);
    expect(find('passTd', 'Derek Carr', 2016)).toBe(28);
    expect(find('rushTd', 'LaDainian Tomlinson', 2006)).toBe(28);
    expect(find('recTd', 'Randy Moss', 2007)).toBe(23);
    expect(find('defInt', 'Ed Reed', 2004)).toBe(9);
    expect(find('fgMade', 'Justin Tucker', 2016)).toBe(38);
  });
  it('keeps half sacks and fractional fantasy points', () => {
    expect(find('sacks', 'T.J. Watt', 2021)).toBe(22.5);
    expect(find('fantasy', 'Christian McCaffrey', 2019)).toBe(471.2);
  });
  it('includes pre-1999 QBs from the validated Wikipedia scrape', () => {
    expect(find('passTd', 'Dan Marino', 1984)).toBe(48);
    expect(find('passYd', 'Dan Marino', 1984)).toBe(5084);
    expect(find('passTd', 'Johnny Unitas', 1959)).toBe(32);
    const qbs = new Set(ds.byCategory.passTd.map((e) => e.player));
    expect(qbs.size).toBeGreaterThan(250);
  });
  it('applies the official-record override where nflverse is wrong', () => {
    expect(find('passYd', 'Elvis Grbac', 2000)).toBe(4169);
  });
  it('uses era-correct team names', () => {
    const carr = ds.byCategory.passTd.find((e) => e.player === 'Derek Carr' && e.year === 2016);
    expect(carr?.team).toBe('Oakland Raiders');
  });
  it('stars are the top N of each season', () => {
    const stars2007 = ds.pool('passTd').stars.filter((e) => e.year === 2007);
    expect(stars2007).toHaveLength(12);
    expect(stars2007.some((e) => e.player === 'Tom Brady')).toBe(true);
  });
});

describe('pickOpponent', () => {
  it('respects the gap band, excludes same player, used seasons and equal values', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 500; i++) {
      const round = i % 20;
      const { key } = CATEGORIES[i % CATEGORIES.length];
      const stars = ds.pool(key).stars;
      const left = stars[i % stars.length];
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
        const stars = ds.pool('passYd').stars;
        const left = stars[i % stars.length];
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

  it('position modes stay within the position and its stats', () => {
    for (const pos of POSITIONS) {
      const run = new ClassicRun(ds, pos.key, mulberry32(21));
      const { categories } = modeSpec(pos.key);
      for (let i = 0; i < 40; i++) {
        const { category, left, right } = run.round;
        expect(categories).toContain(category);
        expect(POSITION_BY_KEY[pos.key].groups).toContain(left.pos);
        expect(POSITION_BY_KEY[pos.key].groups).toContain(right.pos);
        run.guess(right.value >= left.value ? 'higher' : 'lower');
      }
    }
  });

  it('tight end mode plays only tight ends', () => {
    const run = new ClassicRun(ds, 'TE', mulberry32(4));
    for (let i = 0; i < 30; i++) {
      expect(run.round.right.pos).toBe('TE');
      const { left, right } = run.round;
      run.guess(right.value >= left.value ? 'higher' : 'lower');
    }
  });

  it('mixed mode never uses non-core stats', () => {
    expect(modeSpec('mixed').categories).not.toContain('fgMade');
  });
});
