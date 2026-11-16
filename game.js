// Flipstack — constrained prefix-reversal colour sorting.
//
// The stack is an array of colour indices, index 0 = top. Tapping the block
// at position i reverses the prefix [0..i]. The flip is legal only when the
// current top block's colour equals the colour of the block BELOW the tapped
// one (so every flip joins two like-coloured blocks). The round is won when
// the stack holds exactly one run per colour, and lost when no legal flip
// exists first.

"use strict";

const COLORS = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#8338ec", "#fb8500"];
const PER_COLOR = 6;
const N = COLORS.length * PER_COLOR;
const STATS_KEY = "flipstack-stats-v1";

let stack = [];        // colour index per position, 0 = top
let moves = 0;
let roundOver = false;
let animating = false;

const els = {
  stack: document.getElementById("stack"),
  stats: document.getElementById("stats"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayBody: document.getElementById("overlayBody"),
};

// ---------- stats ----------

function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY));
    if (s && typeof s === "object") return { deals: 0, wins: 0, losses: 0, best: null, worst: null, ...s };
  } catch { /* fall through */ }
  return { deals: 0, wins: 0, losses: 0, best: null, worst: null };
}

let stats = loadStats();

function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* private mode */ }
}

function renderStats() {
  const f = (v) => (v == null ? "–" : v);
  els.stats.innerHTML =
    `<span class="moves">moves <b>${moves}</b></span>` +
    `<span>wins <b>${stats.wins}</b></span>` +
    `<span>losses <b>${stats.losses}</b></span>` +
    `<span>best <b>${f(stats.best)}</b></span>` +
    `<span>worst <b>${f(stats.worst)}</b></span>`;
}

// ---------- rules ----------

const runs = (s) => s.reduce((r, c, i) => r + (i === 0 || c !== s[i - 1] ? 1 : 0), 0);
const isWon = (s) => runs(s) === COLORS.length;
// A flip must join the top block to a like-coloured block below the selection,
// and must actually change something: a monochrome prefix reverses to itself
// (those "moves" would let a dead board look alive forever).
const isLegal = (s, i) =>
  i >= 1 && i + 1 < s.length && s[0] === s[i + 1] && s.slice(0, i + 1).some((c) => c !== s[0]);
const hasMove = (s) => s.some((_, i) => isLegal(s, i));

function deal() {
  do {
    stack = COLORS.flatMap((_, c) => Array(PER_COLOR).fill(c));
    for (let i = stack.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stack[i], stack[j]] = [stack[j], stack[i]];
    }
  } while (isWon(stack) || !hasMove(stack)); // never deal a finished or dead board
  moves = 0;
  roundOver = false;
  stats.deals += 1;
  saveStats();
  els.overlay.classList.add("hidden");
  renderBlocks(true);
  renderStats();
}

function abandonIfMidRound() {
  // Re-dealing after making moves counts as a loss; an untouched board is free.
  if (!roundOver && moves > 0) {
    stats.losses += 1;
    saveStats();
  }
}

function endRound(won) {
  roundOver = true;
  if (won) {
    stats.wins += 1;
    if (stats.best == null || moves < stats.best) stats.best = moves;
    if (stats.worst == null || moves > stats.worst) stats.worst = moves;
  } else {
    stats.losses += 1;
  }
  saveStats();
  renderStats();
  els.overlayTitle.textContent = won ? "Sorted!" : "No moves left";
  els.overlayBody.textContent = won
    ? `Solved in ${moves} move${moves === 1 ? "" : "s"}.` +
      (moves === stats.best ? " That's your best." : ` Best: ${stats.best}.`)
    : `The top colour has no match left in the stack. Lost after ${moves} move${moves === 1 ? "" : "s"}.`;
  setTimeout(() => els.overlay.classList.remove("hidden"), 550);
}

function flip(i) {
  if (roundOver || animating) return;
  if (!isLegal(stack, i)) {
    blockEls[i].classList.add("illegal-flash");
    setTimeout(() => blockEls[i].classList.remove("illegal-flash"), 320);
    return;
  }
  const prefix = stack.slice(0, i + 1).reverse();
  stack = prefix.concat(stack.slice(i + 1));
  // Keep DOM nodes paired with their block: reorder the tracking array too.
  blockEls = blockEls.slice(0, i + 1).reverse().concat(blockEls.slice(i + 1));
  moves += 1;
  animating = true;
  setTimeout(() => { animating = false; }, 460);
  position();
  renderStats();
  clearHover();
  if (isWon(stack)) endRound(true);
  else if (!hasMove(stack)) endRound(false);
}

// ---------- rendering ----------

let blockEls = [];

function blockMetrics() {
  // Fit the whole stack in the space <main> actually has, between sensible bounds.
  const gap = 3;
  const available = document.querySelector("main").clientHeight - 16;
  const h = Math.max(10, Math.min(22, Math.floor(available / N) - gap));
  return { h, gap };
}

function position() {
  const { h, gap } = blockMetrics();
  els.stack.style.height = `${N * (h + gap) - gap}px`;
  blockEls.forEach((el, i) => {
    el.style.height = `${h}px`;
    el.style.top = `${i * (h + gap)}px`;
  });
}

function renderBlocks(fresh) {
  if (fresh) {
    els.stack.innerHTML = "";
    blockEls = stack.map((c, i) => {
      const el = document.createElement("div");
      el.className = "block";
      el.style.background = COLORS[c];
      el.addEventListener("click", () => flip(blockEls.indexOf(el)));
      el.addEventListener("mouseenter", () => hover(blockEls.indexOf(el)));
      el.addEventListener("mouseleave", clearHover);
      els.stack.appendChild(el);
      return el;
    });
  }
  position();
}

function hover(i) {
  if (roundOver || animating || !isLegal(stack, i)) return;
  blockEls.slice(0, i + 1).forEach((el) => el.classList.add("lift"));
}

function clearHover() {
  blockEls.forEach((el) => el.classList.remove("lift"));
}

// ---------- wiring ----------

document.getElementById("newDeal").addEventListener("click", () => { abandonIfMidRound(); deal(); });
document.getElementById("overlayDeal").addEventListener("click", deal);
window.addEventListener("resize", position);

// Debug/console handle (handy for testing; not used by the UI).
window.flipstack = {
  state: () => ({ stack: [...stack], moves, roundOver }),
  setStack: (s) => { stack = [...s]; moves = 0; roundOver = false; els.overlay.classList.add("hidden"); renderStats(); renderBlocks(true); },
  flip,
  isLegal: (i) => isLegal(stack, i),
  resetStats: () => { stats = { deals: 0, wins: 0, losses: 0, best: null, worst: null }; saveStats(); renderStats(); },
};

deal();
