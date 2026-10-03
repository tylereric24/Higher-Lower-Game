import { Preferences } from '@capacitor/preferences';
import { daysBetween } from './daily';
import type { Mode } from './game';

export interface DailyRecord {
  date: string;
  results: boolean[];
}

export interface SaveData {
  best: Partial<Record<Mode, number>>;
  gamesPlayed: number;
  guesses: number;
  correct: number;
  daily: {
    history: DailyRecord[];
    streak: number;
    maxStreak: number;
    /** Partial results, so quitting mid-puzzle can't be used to retry known answers. */
    inProgress?: DailyRecord;
  };
  settings: { haptics: boolean };
  /** Cached entitlement so ads stay off at launch before the store responds. */
  noAds: boolean;
}

const KEY = 'save.v1';

const defaults = (): SaveData => ({
  best: {},
  gamesPlayed: 0,
  guesses: 0,
  correct: 0,
  daily: { history: [], streak: 0, maxStreak: 0 },
  settings: { haptics: true },
  noAds: false,
});

// Preferences maps to UserDefaults / SharedPreferences on device, which the OS won't
// evict the way it can evict WebView localStorage. On web it falls back to localStorage.
export let save: SaveData = defaults();

export async function loadSave(): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) {
      const parsed = JSON.parse(value) as Partial<SaveData>;
      const d = defaults();
      save = {
        ...d,
        ...parsed,
        daily: { ...d.daily, ...parsed.daily },
        settings: { ...d.settings, ...parsed.settings },
      };
    }
  } catch {
    save = defaults();
  }
}

export async function persist(): Promise<void> {
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify(save) });
  } catch {
    // Storage unavailable (private browsing): progress just won't survive a reload.
  }
}

export function recordGuess(correct: boolean): void {
  save.guesses++;
  if (correct) save.correct++;
}

/** Returns true when the streak is a new personal best for the mode. */
export function recordRun(mode: Mode, streak: number, newGame: boolean): boolean {
  if (newGame) save.gamesPlayed++;
  const isBest = streak > (save.best[mode] ?? 0);
  if (isBest) save.best[mode] = streak;
  void persist();
  return isBest;
}

export function dailyFor(date: string): DailyRecord | undefined {
  return save.daily.history.find((h) => h.date === date);
}

export function recordDaily(date: string, results: boolean[]): void {
  if (dailyFor(date)) return;
  const last = save.daily.history.at(-1);
  save.daily.streak = last && daysBetween(last.date, date) === 1 ? save.daily.streak + 1 : 1;
  save.daily.maxStreak = Math.max(save.daily.maxStreak, save.daily.streak);
  save.daily.history.push({ date, results });
  save.daily.inProgress = undefined;
  save.daily.history = save.daily.history.slice(-365);
  void persist();
}

/** Daily streak as of today: broken if yesterday's puzzle was skipped. */
export function currentDailyStreak(today: string): number {
  const last = save.daily.history.at(-1);
  if (!last) return 0;
  return daysBetween(last.date, today) <= 1 ? save.daily.streak : 0;
}
