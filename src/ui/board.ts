import { CATEGORY_BY_KEY, type Entry } from '../data';
import type { Guess, Round } from '../game';
import { isCorrect } from '../game';
import { buzz } from '../platform';
import { countUp, esc, sleep } from './dom';
import { navId } from './router';

function card(entry: Entry, unit: string, controls = ''): string {
  return `<section class="card">
    <div class="who">${esc(entry.player)}</div>
    <div class="meta">${esc(entry.team)} &middot; ${entry.year}</div>
    <div class="value hidden" data-value>?</div><div class="unit">${esc(unit)}</div>
    ${controls}
  </section>`;
}

/** Both values hidden: is the bottom player's number higher or lower than the top's? */
export function boardHtml(round: Round, top: string): string {
  const { unit } = CATEGORY_BY_KEY[round.category];
  const controls = `<div class="guess-row">
      <button class="btn guess higher" data-guess="higher">&#9650; Higher</button>
      <button class="btn guess lower" data-guess="lower">&#9660; Lower</button>
    </div>
    <div class="hint">than ${esc(round.left.player)} (${round.left.year})?</div>`;
  return `${top}
  <div class="board">
    ${card(round.left, unit)}
    <div class="vs">VS</div>
    ${card(round.right, unit, controls).replace('class="card"', 'class="card right"')}
  </div>`;
}

/**
 * Wait for a guess, reveal the hidden value, and resolve with the result.
 * Resolves null if the player navigated away mid-round.
 */
export function playRound(el: HTMLElement, round: Round): Promise<{ guess: Guess; correct: boolean } | null> {
  const id = navId;
  return new Promise((resolve) => {
    el.querySelectorAll<HTMLButtonElement>('[data-guess]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const guess = btn.dataset.guess as Guess;
        const correct = isCorrect(round, guess);
        el.querySelectorAll<HTMLButtonElement>('[data-guess]').forEach((b) => (b.disabled = true));
        btn.classList.add('chosen');
        const [leftEl, rightEl] = el.querySelectorAll<HTMLElement>('[data-value]');
        leftEl.classList.remove('hidden');
        rightEl.classList.remove('hidden');
        await Promise.all([countUp(leftEl, round.left.value), countUp(rightEl, round.right.value)]);
        el.querySelector('.card.right')!.classList.add(correct ? 'correct' : 'wrong');
        void buzz(correct ? 'correct' : 'wrong');
        await sleep(correct ? 650 : 1100);
        resolve(id === navId ? { guess, correct } : null);
      }),
    );
  });
}
