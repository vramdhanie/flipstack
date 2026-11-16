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
const STATS_KEY = "flipstack-stats-v2";
const MODE_KEY = "flipstack-mode";

let stack = [];        // colour index per position, 0 = top
let moves = 0;
let roundOver = false;
let animating = false;
let mode = "classic";  // "classic" | "advanced" (advanced = required colour order)
let target = null;     // advanced mode: colour order required top -> bottom

const els = {
  stack: document.getElementById("stack"),
  target: document.getElementById("target"),
  stats: document.getElementById("stats"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayBody: document.getElementById("overlayBody"),
};

// ---------- stats (kept per mode) ----------

const emptyStats = () => ({ deals: 0, wins: 0, losses: 0, best: null, worst: null });

function loadStats() {
  try {
    const v2 = JSON.parse(localStorage.getItem(STATS_KEY));
    if (v2 && v2.classic) return { classic: { ...emptyStats(), ...v2.classic }, advanced: { ...emptyStats(), ...v2.advanced } };
    const v1 = JSON.parse(localStorage.getItem("flipstack-stats-v1"));
    if (v1 && typeof v1 === "object") return { classic: { ...emptyStats(), ...v1 }, advanced: emptyStats() };
  } catch { /* fall through */ }
  return { classic: emptyStats(), advanced: emptyStats() };
}

let allStats = loadStats();
const stats = () => allStats[mode];

function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(allStats)); } catch { /* private mode */ }
}

function renderStats() {
  const s = stats();
  const f = (v) => (v == null ? "–" : v);
  els.stats.innerHTML =
    `<span class="moves">moves <b>${moves}</b></span>` +
    `<span>wins <b>${s.wins}</b></span>` +
    `<span>losses <b>${s.losses}</b></span>` +
    `<span>best <b>${f(s.best)}</b></span>` +
    `<span>worst <b>${f(s.worst)}</b></span>`;
}

// ---------- rules ----------

const runs = (s) => s.reduce((r, c, i) => r + (i === 0 || c !== s[i - 1] ? 1 : 0), 0);
const groupOrder = (s) => s.filter((c, i) => i === 0 || c !== s[i - 1]);
const isWon = (s) =>
  runs(s) === COLORS.length &&
  (mode === "classic" || groupOrder(s).every((c, i) => c === target[i]));
// A flip must join the top block to a like-coloured block below the selection,
// and must actually change something: a monochrome prefix reverses to itself
// (those "moves" would let a dead board look alive forever).
const isLegal = (s, i) =>
  i >= 1 && i + 1 < s.length && s[0] === s[i + 1] && s.slice(0, i + 1).some((c) => c !== s[0]);
const hasMove = (s) => s.some((_, i) => isLegal(s, i));

const shuffled = (a) => {
  const s = [...a];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
};

function deal() {
  target = mode === "advanced" ? shuffled(COLORS.map((_, c) => c)) : null;
  do {
    stack = shuffled(COLORS.flatMap((_, c) => Array(PER_COLOR).fill(c)));
  } while (isWon(stack) || !hasMove(stack)); // never deal a finished or dead board
  moves = 0;
  roundOver = false;
  stats().deals += 1;
  saveStats();
  renderTarget();
  els.overlay.classList.add("hidden");
  renderBlocks(true);
  renderStats();
}

function abandonIfMidRound() {
  // Re-dealing after making moves counts as a loss; an untouched board is free.
  if (!roundOver && moves > 0) {
    stats().losses += 1;
    saveStats();
  }
}

function endRound(won) {
  roundOver = true;
  const s = stats();
  if (won) {
    s.wins += 1;
    if (s.best == null || moves < s.best) s.best = moves;
    if (s.worst == null || moves > s.worst) s.worst = moves;
  } else {
    s.losses += 1;
  }
  saveStats();
  renderStats();
  const sortedWrongOrder = !won && runs(stack) === COLORS.length;
  els.overlayTitle.textContent = won ? "Sorted!" : sortedWrongOrder ? "Sorted — wrong order" : "No moves left";
  els.overlayBody.textContent = won
    ? `Solved in ${moves} move${moves === 1 ? "" : "s"}.` +
      (moves === s.best ? " That's your best." : ` Best: ${s.best}.`)
    : sortedWrongOrder
      ? `All six colours are grouped, but not in the required order. Lost after ${moves} move${moves === 1 ? "" : "s"}.`
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
  // Target bands mirror the finished stack: one band per colour group,
  // each exactly PER_COLOR blocks tall, aligned with the stack rows.
  if (target) {
    const groupH = PER_COLOR * (h + gap) - gap;
    els.target.style.height = els.stack.style.height;
    [...els.target.children].forEach((el, g) => {
      el.style.height = `${groupH}px`;
      el.style.top = `${g * PER_COLOR * (h + gap)}px`;
    });
  }
}

function renderTarget() {
  els.target.classList.toggle("hidden", mode !== "advanced");
  els.target.innerHTML = "";
  if (mode !== "advanced") return;
  target.forEach((c) => {
    const el = document.createElement("div");
    el.className = "band";
    el.style.background = COLORS[c];
    els.target.appendChild(el);
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

document.querySelectorAll("#modeToggle .mode").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.mode === mode) return;
    abandonIfMidRound();
    mode = btn.dataset.mode;
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* private mode */ }
    document.querySelectorAll("#modeToggle .mode").forEach((b) => b.classList.toggle("active", b === btn));
    deal();
  });
});

try {
  const saved = localStorage.getItem(MODE_KEY);
  if (saved === "advanced") {
    mode = "advanced";
    document.querySelectorAll("#modeToggle .mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === "advanced"));
  }
} catch { /* private mode */ }

// Debug/console handle (handy for testing; not used by the UI).
window.flipstack = {
  state: () => ({ stack: [...stack], moves, roundOver, mode, target: target && [...target] }),
  setTarget: (t) => { target = [...t]; renderTarget(); position(); },
  setStack: (s) => { stack = [...s]; moves = 0; roundOver = false; els.overlay.classList.add("hidden"); renderStats(); renderBlocks(true); },
  flip,
  isLegal: (i) => isLegal(stack, i),
  resetStats: () => { allStats = { classic: emptyStats(), advanced: emptyStats() }; saveStats(); renderStats(); },
};

deal();
