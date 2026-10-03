import { CATEGORIES, POSITIONS } from '../data';
import { dateKey, DAILY_ROUNDS, puzzleNumber } from '../daily';
import { modeLabel, type Mode } from '../game';
import { needsPrivacyOptions, showPrivacyOptions } from '../monetization/ads';
import { PRIVACY_POLICY_URL } from '../monetization/config';
import { buyRemoveAds, purchasesSupported, removeAdsPrice, restorePurchases } from '../monetization/purchases';
import { currentDailyStreak, dailyFor, persist, save } from '../storage';
import { APP_NAME, esc, header, on, render, toast } from './dom';
import { go, register, wireNav } from './router';

register('home', () => {
  const today = dateKey();
  const done = dailyFor(today);
  const streak = currentDailyStreak(today);
  const bestAny = Math.max(0, ...Object.values(save.best));
  const el = render(`
    <div class="home">
      <div class="logo">
        <div class="logo-top">GRIDIRON</div>
        <div class="logo-bottom"><span class="up">&#9650;</span> HIGHER / LOWER <span class="down">&#9660;</span></div>
      </div>
      <button class="tile daily ${done ? 'done' : ''}" data-nav="daily">
        <div class="tile-kicker">Daily #${puzzleNumber(today)}${streak ? ` &middot; &#128293; ${streak}` : ''}</div>
        <div class="tile-title">${done ? `${done.results.filter(Boolean).length}/${DAILY_ROUNDS} &middot; see results` : "Today's 10"}</div>
        <div class="tile-sub">${done ? 'New puzzle at midnight' : 'Same 10 matchups for everyone. Share your score.'}</div>
      </button>
      <button class="tile" data-nav="classic-pick">
        <div class="tile-kicker">Classic${bestAny ? ` &middot; high score ${bestAny}` : ''}</div>
        <div class="tile-title">Endless streak</div>
        <div class="tile-sub">Every position, 12 stats, QBs back to the '50s. One miss ends it.</div>
      </button>
      <div class="tile-row">
        <button class="btn" data-nav="stats">Stats</button>
        <button class="btn" data-nav="settings">Settings</button>
      </div>
      <p class="fine">Stats: nflverse (CC-BY 4.0), Wikipedia (CC-BY-SA). Not affiliated with the NFL or any team.</p>
    </div>`);
  wireNav(el);
});

register('stats', () => {
  const today = dateKey();
  const history = save.daily.history;
  const dist = Array.from({ length: DAILY_ROUNDS + 1 }, () => 0);
  history.forEach((h) => dist[h.results.filter(Boolean).length]++);
  const maxDist = Math.max(1, ...dist);
  const accuracy = save.guesses ? Math.round((100 * save.correct) / save.guesses) : 0;
  const modes: Mode[] = ['mixed', ...POSITIONS.map((p) => p.key), ...CATEGORIES.map((c) => c.key)];
  const el = render(`${header('Stats')}
    <div class="kpis">
      <div><b>${save.gamesPlayed}</b><span>runs</span></div>
      <div><b>${accuracy}%</b><span>accuracy</span></div>
      <div><b>${currentDailyStreak(today)}</b><span>daily streak</span></div>
      <div><b>${save.daily.maxStreak}</b><span>max daily</span></div>
    </div>
    <h2>High scores</h2>
    <div class="list">
      ${modes.map((m) => `<div class="row"><span>${esc(modeLabel(m))}</span><b>${save.best[m] ?? 0}</b></div>`).join('')}
    </div>
    <h2>Daily scores <span class="muted">(${history.length} played)</span></h2>
    <div class="dist">
      ${dist
        .map(
          (n, score) =>
            `<div class="dist-row"><span>${score}</span><i style="width:${Math.max(4, (100 * n) / maxDist)}%">${n}</i></div>`,
        )
        .reverse()
        .join('')}
    </div>`);
  wireNav(el);
});

register('settings', () => {
  const price = removeAdsPrice();
  const el = render(`${header('Settings')}
    <div class="list">
      <label class="row"><span>Haptics</span><input type="checkbox" data-set="haptics" ${save.settings.haptics ? 'checked' : ''}></label>
    </div>
    ${
      purchasesSupported
        ? `<h2>Ads</h2><div class="list">
            ${
              save.noAds
                ? `<div class="row"><span>Ads removed</span><b>&#10003;</b></div>`
                : `<button class="row-btn" data-act="buy" ${price ? '' : 'disabled'}><span>Remove ads</span><b>${price ? esc(price) : 'Unavailable'}</b></button>`
            }
            <button class="row-btn" data-act="restore"><span>Restore purchases</span></button>
          </div>`
        : ''
    }
    <h2>Privacy</h2>
    <div class="list">
      ${needsPrivacyOptions() ? `<button class="row-btn" data-act="privacy"><span>Ad privacy choices</span></button>` : ''}
      <a class="row-btn" href="${esc(PRIVACY_POLICY_URL)}" target="_blank" rel="noopener"><span>Privacy policy</span><span>&#8599;</span></a>
    </div>
    <h2>About</h2>
    <p class="fine left">${esc(APP_NAME)} v${__APP_VERSION__}. Regular-season stats from 1999 on are from
      <a href="https://github.com/nflverse/nflverse-data" target="_blank" rel="noopener">nflverse</a>
      (CC-BY 4.0). Earlier quarterback seasons are from
      <a href="https://en.wikipedia.org/" target="_blank" rel="noopener">Wikipedia</a> (CC-BY-SA 4.0). Player names and team names are used for identification only. Not affiliated with
      or endorsed by the NFL, the NFLPA, or any team.</p>`);
  wireNav(el);
  el.querySelector<HTMLInputElement>('[data-set="haptics"]')?.addEventListener('change', (e) => {
    save.settings.haptics = (e.target as HTMLInputElement).checked;
    void persist();
  });
  on(el, '[data-act]', async (_, t) => {
    switch (t.dataset.act) {
      case 'buy': {
        const outcome = await buyRemoveAds();
        if (outcome === 'purchased') toast('Ads removed. Thanks!');
        else if (outcome === 'failed') toast('Purchase failed');
        go('settings');
        break;
      }
      case 'restore':
        toast((await restorePurchases()) ? 'Purchases restored' : 'Nothing to restore');
        go('settings');
        break;
      case 'privacy':
        await showPrivacyOptions();
        break;
    }
  });
});
