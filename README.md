# Chess Review

A static, browser-based chess game review, similar in spirit to chess.com’s Game Review. Paste a PGN or a move list, or upload a `.pgn` file, and Stockfish 19 (lite, running in a Web Worker) scores every move.

The live app, when published to GitHub Pages, is at:

**https://jdjlvj2013-glitch.github.io/chess-review/**

Open `index.html` from any static host, or from this folder:

```bash
python3 -m http.server 4173
```

Then visit http://127.0.0.1:4173/. It also works offline once the page and engine have been loaded, because the engine and `chess.js` are vendored here.

## What it does

- Import a PGN, a plain SAN move list such as `1. e4 e5 2. Nf3`, or a `.pgn` file. You can also set a starting FEN.
- Analyze every position with Stockfish in the browser. The default depth is 18; you can pick 12–22. A progress bar updates as it goes.
- Classify each move with chess.com-style labels, symbols, and colors:
  - Brilliant **!!** (teal)
  - Great **!** (blue)
  - Best **★** (green)
  - Excellent **👍**
  - Good **✓**
  - Book **📖**
  - Inaccuracy **?!** (yellow)
  - Mistake **?** (orange)
  - Miss **✕**
  - Blunder **??** (red)
- Show per-player accuracy and a count of each classification.
- An interactive board with SVG pieces, a classification badge on the destination square, an arrow for the engine’s best move, an evaluation bar, a clickable evaluation graph, a colored move list, and the best line for the current move. Arrow keys, Home, and End step through the game.

## How classifications work

chess.com does not publish its exact formula. This app approximates it.

Centipawns are converted to expected points (winning chances from 0 to 1) with the well-known Lichess logistic, which is the usual stand-in for chess.com’s expected-points model:

```
EP = 1 / (1 + exp(-0.00368208 * cp))
```

Mate scores are treated as a nearly certain win or loss. Each move’s **expected points lost** is:

```
EP(loss) = max(0, EP(best move) - EP(played move))
```

from the player’s point of view. If the played move is the engine’s top choice, the loss is treated as 0 (engines can disagree slightly between the search before and after a move).

The cutoffs below follow the table chess.com publishes for Classification V2:

| Classification | Expected points lost |
| --- | --- |
| Best ★ | 0 (or ≤ 0.005, to absorb engine noise) |
| Excellent 👍 | 0 < loss ≤ 0.02 |
| Good ✓ | 0.02 < loss ≤ 0.05 |
| Inaccuracy ?! | 0.05 < loss ≤ 0.10 |
| Mistake ? | 0.10 < loss ≤ 0.20 |
| Blunder ?? | loss > 0.20 |

Special labels use extra rules, also based on chess.com’s published descriptions:

- **Book 📖** — The move is still on a line in the small bundled opening list (standard starting position only). Book moves score as 100% accuracy and are not given error labels.
- **Brilliant !!** — Best or nearly best (loss ≤ 0.02), a *sound piece sacrifice* (the opponent can grab at least a minor piece, 3 pawns of material, even after a cheap recapture), you are not in a bad position afterwards (EP ≥ 0.40), and you would not already be completely winning if you had missed it (the second-best line is under EP 0.90). Not awarded when there is only one legal move.
- **Great !** — Best or nearly best, and either the only good move (the second-best line loses at least 0.10 expected points), a save (alternatives are losing, this move is about equal or better), or a conversion (alternatives are not winning, this move is). Not awarded in an already-trivial win or when there is only one legal move.
- **Miss ✕** — The opponent’s previous move was a mistake or blunder, the best move would have reached a winning position (EP ≥ 0.75), and the move played did not (EP < 0.70) and lost at least 0.05 expected points.

“Winning,” “losing,” and “already winning” here are fixed expected-point levels (about +300 cp, −300 cp, and +550–600 cp). chess.com also varies some of these by rating; this app does not.

## Accuracy

chess.com’s Accuracy score is powered by **CAPS2**, which is proprietary. This app uses the published Lichess formula as an approximation based on win-percentage loss:

```
move accuracy = 103.1668 * exp(-0.04354 * winPercentLoss) - 3.1669
game accuracy = average of each side’s move accuracies
```

`winPercentLoss` is expected-points loss × 100. Book moves and engine-best moves count as 0 loss.

## Engine

The vendored engine is **Stockfish 19 lite, single-threaded** (`vendor/stockfish/`), from [stockfish.js](https://github.com/nmrugg/stockfish.js). The lite network is far smaller than the full engine (~1.7 MB vs ~94 MB) and still much stronger than any human. The single-threaded build does **not** need `SharedArrayBuffer` or special COOP/COEP headers, so it runs on GitHub Pages.

Move legality and PGN parsing use vendored [chess.js](https://github.com/jhlywa/chess.js) 1.4.0.

## Tests

```bash
npm install
npx playwright install chromium
npm test
```

Unit tests cover the classification thresholds. Playwright loads two real games, including Byrne vs Fischer 1956 (“Game of the Century”), and checks that 17…Be6 is Brilliant (or at least Best/Great) and that an obvious queen-hang is a Blunder.

## Known limits

- Labels and accuracy approximate chess.com; they will not match Game Review move-for-move. The exact chess.com formula, rating-dependent generosity, cloud opening book, and official review engine are not public.
- The lite network and a fixed depth (default 18) are weaker than a long desktop Stockfish search. Deeper is slower.
- The opening book is a small bundled list, not a cloud book, so some theory may be labeled Best rather than Book, and a rare sideline might be tagged Book incorrectly if it shares a prefix.
- Sacrifice, “only move,” and Miss detection are heuristics.
- No endgame tablebases, no server, and no account. Everything runs in your browser.
- Because of Stockfish, this project is licensed under GPL-3.0.

## License

GPL-3.0-only. See `LICENSE` and `vendor/stockfish/Copying.txt`. chess.js is BSD-2-Clause (`vendor/chess.js.LICENSE`). Piece artwork follows the public-domain CBurnett set.
