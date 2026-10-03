import { describe, expect, it } from 'vitest';
import { getDataset } from './data';
import { dailyRounds, dateKey, DAILY_EPOCH, puzzleNumber, shareText } from './daily';

const ds = getDataset();

describe('daily challenge', () => {
  it('is identical for everyone on the same date', () => {
    const a = dailyRounds(ds, '2026-11-05');
    const b = dailyRounds(ds, '2026-11-05');
    expect(a.map((r) => [r.left.seasonId, r.right.seasonId])).toEqual(b.map((r) => [r.left.seasonId, r.right.seasonId]));
  });

  it('differs day to day', () => {
    const a = dailyRounds(ds, '2026-11-05').map((r) => r.right.seasonId);
    const b = dailyRounds(ds, '2026-11-06').map((r) => r.right.seasonId);
    expect(a).not.toEqual(b);
  });

  it('has 10 rounds, 10 different stats, no player appears twice', () => {
    for (let d = 1; d <= 60; d++) {
      const key = `2027-01-${String((d % 28) + 1).padStart(2, '0')}`;
      const rounds = dailyRounds(ds, key);
      expect(rounds).toHaveLength(10);
      expect(new Set(rounds.map((r) => r.category)).size).toBe(10);
      expect(rounds.map((r) => r.category)).not.toContain('fgMade');
      const names = rounds.flatMap((r) => [r.left.player, r.right.player]);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('only uses league leaders, so a shared puzzle never hinges on an obscure name', () => {
    for (let d = 1; d <= 28; d++) {
      for (const r of dailyRounds(ds, `2027-02-${String(d).padStart(2, '0')}`)) {
        const stars = new Set(ds.pool(r.category).stars.map((e) => e.seasonId));
        expect(stars.has(r.left.seasonId) && stars.has(r.right.seasonId)).toBe(true);
      }
    }
  });

  it('numbers puzzles from the epoch across DST and month boundaries', () => {
    expect(puzzleNumber(DAILY_EPOCH)).toBe(1);
    expect(puzzleNumber('2026-10-02')).toBe(2);
    expect(puzzleNumber('2026-11-02')).toBe(33);
    expect(puzzleNumber('2027-03-15')).toBe(166);
  });

  it('formats local date keys', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('builds a spoiler-free share string', () => {
    expect(shareText('Game', '2026-10-01', [true, false, true])).toBe('Game #1 2/3\n🟩🟥🟩');
  });
});
