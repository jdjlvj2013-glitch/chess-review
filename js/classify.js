/**
 * Move classification approximating chess.com Game Review.
 *
 * Chess.com's exact formula is not public. This module uses the published
 * Lichess logistic to convert centipawns into expected points (winning
 * chances from 0 to 1), then applies the Expected Points cutoffs published
 * in chess.com's help center. Special labels (Brilliant, Great, Miss, Book)
 * follow chess.com's published prose rules with explicit heuristics.
 */

export const CP_K = 0.00368208;

/** Expected-points loss cutoffs (chess.com Classification V2, published table). */
export const EP_LOSS = {
  /** Treat as Best when the move is the engine move, or loss is at or under this. */
  best: 0.005,
  excellent: 0.02,
  good: 0.05,
  inaccuracy: 0.10,
  mistake: 0.20,
};

/** Expected-points levels used by special labels. */
export const EP_LEVEL = {
  /** ~+300 cp. "Winning" for Great / Miss / already-winning checks. */
  winning: 0.75,
  /** Slightly short of winning, used so a Miss must actually drop the win. */
  winningMiss: 0.7,
  /** ~-300 cp. */
  losing: 0.25,
  /** Not clearly worse after a Brilliant (~-110 cp). */
  notBad: 0.4,
  /** Already a trivial win without the brilliant/great move (~+550–600 cp). */
  alreadyWinning: 0.9,
  /** Minimum gap between best and 2nd best to count as an "only good move". */
  onlyGoodGap: 0.1,
};

export const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const CLASS_META = {
  brilliant: {
    id: "brilliant",
    label: "Brilliant",
    symbol: "!!",
    badge: "!!",
    color: "#00c2a8",
  },
  great: {
    id: "great",
    label: "Great",
    symbol: "!",
    badge: "!",
    color: "#3b9eff",
  },
  best: {
    id: "best",
    label: "Best",
    symbol: "★",
    badge: "★",
    color: "#5cbf6a",
  },
  excellent: {
    id: "excellent",
    label: "Excellent",
    symbol: "👍",
    badge: "👍",
    color: "#86c46c",
  },
  good: {
    id: "good",
    label: "Good",
    symbol: "✓",
    badge: "✓",
    color: "#9aa37a",
  },
  book: {
    id: "book",
    label: "Book",
    symbol: "📖",
    badge: "📖",
    color: "#c4a06a",
  },
  inaccuracy: {
    id: "inaccuracy",
    label: "Inaccuracy",
    symbol: "?!",
    badge: "?!",
    color: "#f0c14a",
  },
  mistake: {
    id: "mistake",
    label: "Mistake",
    symbol: "?",
    badge: "?",
    color: "#f07832",
  },
  miss: {
    id: "miss",
    label: "Miss",
    symbol: "✕",
    badge: "✕",
    color: "#e45c7a",
  },
  blunder: {
    id: "blunder",
    label: "Blunder",
    symbol: "??",
    badge: "??",
    color: "#e33c2c",
  },
};

export const CLASS_ORDER = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
];

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Expected points in [0, 1] from the player's point of view.
 * Lichess / commonly cited chess.com-style logistic:
 *   EP = 1 / (1 + exp(-0.00368208 * cp))
 */
export function expectedPoints(score) {
  if (!score) return 0.5;
  if (score.mate != null) {
    const n = score.mate;
    if (n > 0) return 1 - Math.min(0.02, 0.002 * n);
    if (n < 0) return Math.min(0.02, 0.002 * Math.abs(n));
    return 0.5;
  }
  const cp = clamp(Number(score.cp) || 0, -1500, 1500);
  return 1 / (1 + Math.exp(-CP_K * cp));
}

export function winPercent(score) {
  return expectedPoints(score) * 100;
}

export function flipScore(score) {
  if (!score) return { cp: 0 };
  if (score.mate != null) return { mate: -score.mate };
  return { cp: -(score.cp ?? 0) };
}

export function formatScore(score, { whitePov = true } = {}) {
  const s = whitePov ? score : flipScore(score);
  if (!s) return "0.00";
  if (s.mate != null) {
    const n = s.mate;
    if (n === 0) return "0.00";
    return n > 0 ? `M${n}` : `-M${Math.abs(n)}`;
  }
  const pawns = (s.cp ?? 0) / 100;
  const sign = pawns > 0 ? "+" : "";
  return `${sign}${pawns.toFixed(2)}`;
}

export function baseClassification(epLoss, { isEngineBest = false } = {}) {
  if (isEngineBest || epLoss <= EP_LOSS.best) return "best";
  if (epLoss <= EP_LOSS.excellent) return "excellent";
  if (epLoss <= EP_LOSS.good) return "good";
  if (epLoss <= EP_LOSS.inaccuracy) return "inaccuracy";
  if (epLoss <= EP_LOSS.mistake) return "mistake";
  return "blunder";
}

/**
 * Per-move accuracy used by Lichess, widely used as a stand-in for
 * chess.com's unpublished CAPS2 formula.
 * winPercentLoss is in percentage points (0–100).
 */
export function moveAccuracy(winPercentLoss) {
  const a = 103.1668 * Math.exp(-0.04354 * winPercentLoss) - 3.1669;
  return clamp(a, 0, 100);
}

export function playerAccuracy(winPercentLosses) {
  if (!winPercentLosses.length) return 100;
  const total = winPercentLosses.reduce((s, x) => s + moveAccuracy(x), 0);
  return total / winPercentLosses.length;
}

export function materialNet(chess, color) {
  let net = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq) continue;
      const v = PIECE_VALUE[sq.type] || 0;
      net += sq.color === color ? v : -v;
    }
  }
  return net;
}

/**
 * Largest material the opponent can immediately grab (pawn units), after a
 * cheap recapture on the same square if one exists. A value >= 3 means a
 * piece (minor or more) is being offered.
 */
export function materialOffer(chess, moverColor) {
  const startNet = materialNet(chess, moverColor);
  const captures = chess.moves({ verbose: true }).filter((m) => m.captured);
  let maxDrop = 0;
  for (const m of captures) {
    chess.move(m);
    let net = materialNet(chess, moverColor);
    const recaps = chess.moves({ verbose: true }).filter((r) => r.to === m.to);
    if (recaps.length) {
      recaps.sort((a, b) => PIECE_VALUE[a.piece] - PIECE_VALUE[b.piece]);
      chess.move(recaps[0]);
      net = materialNet(chess, moverColor);
      chess.undo();
    }
    chess.undo();
    maxDrop = Math.max(maxDrop, startNet - net);
  }
  return maxDrop;
}

/**
 * Classify a single move.
 *
 * @param {object} args
 * @param {string} args.playedUci
 * @param {string} args.bestUci
 * @param {{cp?: number, mate?: number}} args.bestScore  from the mover
 * @param {{cp?: number, mate?: number}} args.playedScore  from the mover
 * @param {{cp?: number, mate?: number}|null} args.secondBestScore
 * @param {number} args.legalMoveCount
 * @param {boolean} args.isBook
 * @param {string|null} args.opponentPrevClass
 * @param {number} args.materialOffer  pawn units the opponent can grab
 */
export function classifyMove(args) {
  const {
    playedUci,
    bestUci,
    bestScore,
    playedScore,
    secondBestScore = null,
    legalMoveCount = 2,
    isBook = false,
    opponentPrevClass = null,
    materialOffer: offer = 0,
  } = args;

  const bestEP = expectedPoints(bestScore);
  const playedEP = expectedPoints(playedScore);
  const rawEpLoss = Math.max(0, bestEP - playedEP);
  const isEngineBest = Boolean(playedUci && bestUci && playedUci === bestUci);
  const epLoss = isEngineBest ? 0 : rawEpLoss;
  const wpLoss = (isEngineBest ? 0 : rawEpLoss) * 100;
  const secondEP = secondBestScore ? expectedPoints(secondBestScore) : null;
  const secondLoss = secondEP != null ? Math.max(0, bestEP - secondEP) : 0;
  const nearBest = isEngineBest || epLoss <= EP_LOSS.excellent;
  const notOnlyLegal = legalMoveCount > 1;

  const result = {
    classification: "best",
    epLoss,
    rawEpLoss,
    wpLoss,
    bestEP,
    playedEP,
    secondEP,
    isEngineBest,
    accuracy: moveAccuracy(isBook ? 0 : wpLoss),
  };

  if (isBook) {
    result.classification = "book";
    result.wpLoss = 0;
    result.accuracy = 100;
    return result;
  }

  // Brilliant: best or nearly best, a sound piece sacrifice, not already a
  // trivial win without it, and not a losing position afterwards.
  if (
    nearBest &&
    notOnlyLegal &&
    offer >= 3 &&
    playedEP >= EP_LEVEL.notBad &&
    (secondEP == null || secondEP < EP_LEVEL.alreadyWinning)
  ) {
    result.classification = "brilliant";
    return result;
  }

  // Great: the only good move, or a move that changes the outcome versus
  // the alternatives. Skip once the position is already a trivial win.
  if (nearBest && notOnlyLegal && bestEP < EP_LEVEL.alreadyWinning && secondEP != null) {
    const onlyGood = secondLoss >= EP_LEVEL.onlyGoodGap;
    const saves = secondEP <= EP_LEVEL.losing && playedEP >= 0.45;
    const converts =
      secondEP < EP_LEVEL.winning &&
      playedEP >= EP_LEVEL.winning &&
      playedEP - secondEP >= 0.15;
    if (onlyGood || saves || converts) {
      result.classification = "great";
      return result;
    }
  }

  // Miss: failed to punish an opponent mistake/blunder and did not keep a win.
  const oppErred = opponentPrevClass === "mistake" || opponentPrevClass === "blunder";
  if (
    oppErred &&
    !nearBest &&
    bestEP >= EP_LEVEL.winning &&
    playedEP < EP_LEVEL.winningMiss &&
    epLoss >= EP_LOSS.good
  ) {
    result.classification = "miss";
    return result;
  }

  result.classification = baseClassification(epLoss, { isEngineBest });
  return result;
}

export function emptyCounts() {
  const counts = {};
  for (const id of CLASS_ORDER) counts[id] = 0;
  return counts;
}

export function summarize(moveResults) {
  const byColor = {
    w: { counts: emptyCounts(), losses: [], accuracy: 100 },
    b: { counts: emptyCounts(), losses: [], accuracy: 100 },
  };
  for (const m of moveResults) {
    const side = m.color === "b" ? "b" : "w";
    byColor[side].counts[m.classification] += 1;
    byColor[side].losses.push(m.wpLoss ?? 0);
  }
  for (const side of ["w", "b"]) {
    byColor[side].accuracy = playerAccuracy(byColor[side].losses);
  }
  return byColor;
}
