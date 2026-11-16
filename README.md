# Flipstack

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Static](https://img.shields.io/badge/stack-vanilla%20HTML%2FCSS%2FJS-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org)

A one-tap colour-sorting puzzle built on constrained prefix reversal (pancake
flips). Six colours, six blocks each, dealt in random order.

## Rules

- Tap a block: it and every block above it flip upside down as one unit,
  keeping their order within the flip.
- A flip is only **legal** when it lands the current top block on a block of
  the same colour — i.e. the block *below* the one you tapped must match the
  colour currently on top. Every move therefore joins two like-coloured
  blocks.
- Flips that change nothing (a single-colour prefix) are not moves.
- **Win** when all six colours sit in contiguous groups. **Lose** when no
  legal flip remains — which happens exactly when the top colour's full group
  reaches the top while the rest is still unsorted, so watch what you send up
  there.
- Fewest moves wins bragging rights.

## Stats

The header tracks moves in the current round; wins, losses, best (fewest
moves in a win) and worst persist in `localStorage`. Re-dealing after making
at least one move counts as a loss.

## Running

No build step — it's three static files. Open `index.html`, or serve the
folder:

```bash
python3 -m http.server 3220
```

## Deployment

Intended for GitHub Pages: serve the repo root from the `main` branch
(Settings → Pages → Deploy from a branch).
