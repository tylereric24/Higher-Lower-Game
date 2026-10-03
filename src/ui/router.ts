import { hideBanner, showBanner } from '../monetization/ads';

export type ScreenName = 'home' | 'classic-pick' | 'play' | 'daily' | 'stats' | 'settings';

type ScreenFn = (arg?: unknown) => void;
const screens = new Map<ScreenName, ScreenFn>();
export let current: ScreenName = 'home';
/** Bumped on every navigation so async game loops can tell they've been abandoned. */
export let navId = 0;

export function register(name: ScreenName, fn: ScreenFn): void {
  screens.set(name, fn);
}

/** Banner ads never sit under live gameplay: avoids accidental taps (AdMob policy). */
const NO_BANNER: ScreenName[] = ['play', 'daily'];

export function go(name: ScreenName, arg?: unknown): void {
  current = name;
  navId++;
  if (NO_BANNER.includes(name)) void hideBanner();
  else void showBanner();
  screens.get(name)!(arg);
}

/** Any element with data-nav="screen" navigates on click. */
export function wireNav(el: ParentNode): void {
  el.querySelectorAll<HTMLElement>('[data-nav]').forEach((t) =>
    t.addEventListener('click', () => go(t.dataset.nav as ScreenName)),
  );
}
