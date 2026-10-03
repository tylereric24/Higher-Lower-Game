import { CATEGORY_BY_KEY, getDataset } from '../data';
import { dailyRounds, DAILY_ROUNDS, dateKey, puzzleNumber, shareText } from '../daily';
import { shareResult } from '../platform';
import { currentDailyStreak, dailyFor, persist, recordDaily, recordGuess, save } from '../storage';
import { boardHtml, playRound } from './board';
import { APP_NAME, esc, fmt, header, on, render, toast } from './dom';
import { navId, register, wireNav } from './router';

function dots(results: boolean[]): string {
  return Array.from({ length: DAILY_ROUNDS }, (_, i) => {
    const cls = i < results.length ? (results[i] ? 'ok' : 'miss') : i === results.length ? 'now' : '';
    return `<i class="dot ${cls}"></i>`;
  }).join('');
}

register('daily', () => {
  const today = dateKey();
  if (dailyFor(today)) return showResults(today);
  void playDaily(today);
});

async function playDaily(today: string): Promise<void> {
  const rounds = dailyRounds(getDataset(), today);
  const progress = save.daily.inProgress;
  const results = progress?.date === today ? progress.results.slice() : [];

  while (results.length < rounds.length) {
    const round = rounds[results.length];
    const label = CATEGORY_BY_KEY[round.category].label;
    const el = render(
      boardHtml(round, `${header(`Daily #${puzzleNumber(today)}`)}
        <div class="progress">${dots(results)}<span>${esc(label)}</span></div>`),
      'play',
    );
    wireNav(el);
    const result = await playRound(el, round);
    if (!result) return;
    results.push(result.correct);
    recordGuess(result.correct);
    save.daily.inProgress = { date: today, results: results.slice() };
    void persist();
  }
  recordDaily(today, results);
  showResults(today);
}

function untilMidnight(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const s = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function showResults(today: string): void {
  const record = dailyFor(today)!;
  const rounds = dailyRounds(getDataset(), today);
  const score = record.results.filter(Boolean).length;
  const el = render(`${header(`Daily #${puzzleNumber(today)}`)}
    <div class="over">
      <div class="over-label">Today's score</div>
      <div class="big-score">${score}<span class="of">/${record.results.length}</span></div>
      <div class="grid">${record.results.map((r) => (r ? '&#129001;' : '&#128997;')).join('')}</div>
      <div class="muted">Daily streak &#128293; ${currentDailyStreak(today)} &middot; next puzzle in <span data-clock>${untilMidnight()}</span></div>
      <div class="stack">
        <button class="btn primary" data-act="share">Share result</button>
        <button class="btn ghost" data-nav="home">Home</button>
      </div>
      <ol class="review">
        ${rounds
          .map((r, i) => {
            const { unit } = CATEGORY_BY_KEY[r.category];
            return `<li class="${record.results[i] ? 'ok' : 'miss'}">
              <strong>${esc(r.right.player)}</strong> ${r.right.year}: ${fmt(r.right.value)}
              <span class="muted">vs ${esc(r.left.player)} ${r.left.year}: ${fmt(r.left.value)} ${esc(unit)}</span>
            </li>`;
          })
          .join('')}
      </ol>
    </div>`);
  wireNav(el);
  on(el, '[data-act="share"]', async () => {
    if ((await shareResult(shareText(APP_NAME, today, record.results))) === 'copied') toast('Copied to clipboard');
  });
  const id = navId;
  const timer = setInterval(() => {
    const clock = el.querySelector('[data-clock]');
    if (id !== navId || !clock) return clearInterval(timer);
    clock.textContent = untilMidnight();
  }, 1000);
}
