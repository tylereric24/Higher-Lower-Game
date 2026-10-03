import { CATEGORIES, CATEGORY_BY_KEY, getDataset } from '../data';
import { ClassicRun, type Mode, type Round } from '../game';
import { hideBanner, onRunFinished, rewardedAvailable, showBanner, showRewarded } from '../monetization/ads';
import { shareResult } from '../platform';
import { recordGuess, recordRun, save } from '../storage';
import { boardHtml, playRound } from './board';
import { APP_NAME, esc, fmt, header, on, render, toast } from './dom';
import { go, register, wireNav } from './router';

export function modeLabel(mode: Mode): string {
  return mode === 'mixed' ? 'Mixed' : CATEGORY_BY_KEY[mode].label;
}

register('classic-pick', () => {
  const modes: Mode[] = ['mixed', ...CATEGORIES.map((c) => c.key)];
  const el = render(`${header('Classic')}
    <p class="lede">Keep the streak alive. One miss and it's over. It gets harder as you go.</p>
    <div class="list">
      ${modes
        .map(
          (m) => `<button class="row-btn" data-mode="${m}">
            <span>${esc(modeLabel(m))}${m === 'mixed' ? ' <em>all stats</em>' : ''}</span>
            <span class="muted">Best ${save.best[m] ?? 0}</span>
          </button>`,
        )
        .join('')}
    </div>`);
  wireNav(el);
  on(el, '[data-mode]', (_, t) => go('play', t.dataset.mode));
});

register('play', (arg) => {
  void runLoop(new ClassicRun(getDataset(), arg as Mode, Math.random));
});

async function runLoop(run: ClassicRun): Promise<void> {
  void hideBanner();
  for (;;) {
    const round = run.round;
    const el = render(
      boardHtml(round, header(modeLabel(run.mode), `<span class="streak">&#128293; ${run.streak}</span>`)),
      'play',
    );
    wireNav(el);
    const result = await playRound(el, round);
    if (!result) return;
    run.guess(result.guess);
    recordGuess(result.correct);
    if (!result.correct) return gameOver(run, round);
  }
}

function gameOver(run: ClassicRun, missed: Round): void {
  const isBest = recordRun(run.mode, run.streak, run.continuesUsed === 0);
  const { unit } = CATEGORY_BY_KEY[missed.category];
  const canContinue = run.continuesUsed === 0 && rewardedAvailable();
  void showBanner();
  const el = render(`
    <div class="over">
      <div class="over-label">${isBest && run.streak > 0 ? 'New personal best' : 'Run over'}</div>
      <div class="big-score">${run.streak}</div>
      <div class="muted">${esc(modeLabel(run.mode))} &middot; best ${save.best[run.mode] ?? 0}</div>
      <p class="answer">
        <strong>${esc(missed.right.player)}</strong> (${missed.right.year}) had
        <strong>${fmt(missed.right.value)}</strong> ${esc(unit)}, vs
        <strong>${fmt(missed.left.value)}</strong> for ${esc(missed.left.player)} (${missed.left.year}).
      </p>
      <div class="stack">
        ${canContinue ? `<button class="btn primary" data-act="continue">&#9654; Keep streak &middot; watch ad</button>` : ''}
        <button class="btn ${canContinue ? '' : 'primary'}" data-act="again">Play again</button>
        <button class="btn" data-act="share">Share</button>
        <button class="btn ghost" data-act="home">Home</button>
      </div>
    </div>`);

  on(el, '[data-act]', async (_, t) => {
    switch (t.dataset.act) {
      case 'continue':
        if (await showRewarded()) {
          run.continueRun();
          void runLoop(run);
        } else {
          toast('Ad not completed');
        }
        break;
      case 'again':
        await onRunFinished();
        go('play', run.mode);
        break;
      case 'share': {
        const text = `I hit a ${run.streak} streak on ${modeLabel(run.mode)} in ${APP_NAME}. Beat it.`;
        if ((await shareResult(text)) === 'copied') toast('Copied to clipboard');
        break;
      }
      case 'home':
        await onRunFinished();
        go('home');
        break;
    }
  });
}
