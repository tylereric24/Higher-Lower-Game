export const APP_NAME = 'Gridiron Higher/Lower';

import { formatValue as fmt } from '../data';

const root = () => document.getElementById('app')!;

export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export { formatValue as fmt } from '../data';

/** Replace the screen contents and return the root for event wiring. */
export function render(html: string, className = ''): HTMLElement {
  const el = root();
  el.className = `screen ${className}`.trim();
  el.innerHTML = html;
  el.scrollTop = 0;
  return el;
}

export function on(el: ParentNode, selector: string, handler: (e: Event, target: HTMLElement) => void): void {
  el.querySelectorAll<HTMLElement>(selector).forEach((t) => t.addEventListener('click', (e) => handler(e, t)));
}

export function toast(message: string): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 1800);
  setTimeout(() => t.remove(), 2200);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Animate a number from 0 to its value; resolves when done. */
export function countUp(el: HTMLElement, to: number, ms = 650): Promise<void> {
  return new Promise((resolve) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = fmt(to);
      return resolve();
    }
    const start = performance.now();
    // Half sacks and fantasy points count up in tenths; everything else in whole numbers.
    const step10 = Number.isInteger(to) ? 1 : 10;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(p < 1 ? Math.round(to * eased * step10) / step10 : to);
      if (p < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export function header(title: string, right = ''): string {
  return `<header class="bar">
    <button class="icon-btn" data-nav="home" aria-label="Back">&#8592;</button>
    <h1>${esc(title)}</h1>
    <div class="bar-right">${right}</div>
  </header>`;
}
