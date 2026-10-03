import { CATEGORIES, CATEGORY_BY_KEY, getDataset, POSITIONS } from '../data';
import { ClassicRun, modeLabel, type Mode, type Round } from '../game';
import { hideBanner, onRunFinished, rewardedAvailable, showBanner, showRewarded } from '../monetization/ads';
import { shareResult } from '../platform';
import { recordBest, recordGuess, recordRunEnd, save } from '../storage';
import { boardHtml, playRound } from './board';
import { APP_NAME, esc, fmt, header, on, render, toast } from './dom';
import { go, register, wireNav } from './router';

function modeButton(mode: Mode, note = ''): string {
  return `<button class="row-btn" data-mode="${mode}">
    <span>${esc(modeLabel(mode))}${note ? `<small>${esc(note)}</small>` : ''}</span>
    <span class="muted nowrap">Best ${save.best[mode] ?? 0}</span>
  </button>`;
}

register('classic-pick', () => {
  const el = render(`${header('Classic')}
    <p class="lede">Keep the streak alive. One miss and it's over. It gets harder as you go.</p>
    <div class="list">${modeButton('mixed', 'every stat')}</div>
    <h2>By position</h2>
    <div class="list">
      ${POSITIONS.map((p) => modeButton(p.key, p.categories.map((c) => CATEGORY_BY_KEY[c].label).join(', '))).join('')}
    </div>
    <h2>By stat</h2>
    <div class="list">${CATEGORIES.map((c) => modeButton(c.key)).join('')}</div>`);
  wireNav(el);
  on(el, '[data-mode]', (_, t) => go('play', t.dataset.mode));
});

register('play', (arg) => {
  const mode = arg as Mode;
  void runLoop(new ClassicRun(getDataset(), mode, Math.random), save.best[mode] ?? 0);
});

function scoreboard(streak: number, bestAtStart: number): string {
  const newBest = streak > bestAtStart && bestAtStart > 0;
  return `<div class="scoreboard">
    <span class="streak">&#128293; ${streak}</span>
    <span class="best ${newBest ? 'new' : ''}">${newBest ? 'NEW BEST' : `Best ${Math.max(bestAtStart, streak)}`}</span>
  </div>`;
}

async function runLoop(run: ClassicRun, bestAtStart: number): Promise<void> {
  void hideBanner();
  for (;;) {
    const round = run.round;
    const el = render(boardHtml(round, header(modeLabel(run.mode), scoreboard(run.streak, bestAtStart))), 'play');
    wireNav(el);
    const result = await playRound(el, round);
    if (!result) return;
    run.guess(result.guess);
    recordGuess(result.correct);
    if (result.correct) recordBest(run.mode, run.streak);
    else return gameOver(run, round, bestAtStart);
  }
}

function gameOver(run: ClassicRun, missed: Round, bestAtStart: number): void {
  if (run.continuesUsed === 0) recordRunEnd();
  const isBest = run.streak > bestAtStart;
  const { unit } = CATEGORY_BY_KEY[missed.category];
  const canContinue = run.continuesUsed === 0 && rewardedAvailable();
  void showBanner();
  const el = render(`
    <div class="over">
      <div class="over-label">${isBest && run.streak > 0 ? 'New high score' : 'Run over'}</div>
      <div class="big-score">${run.streak}</div>
      <div class="muted">${esc(modeLabel(run.mode))} &middot; high score ${save.best[run.mode] ?? 0}</div>
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
          void runLoop(run, bestAtStart);
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
