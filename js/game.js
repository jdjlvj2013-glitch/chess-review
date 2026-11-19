import { Chess, validateFen } from "../vendor/chess.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function isStartFen(fen) {
  if (!fen) return true;
  return normalizeFen(fen) === normalizeFen(START_FEN);
}

export function normalizeFen(fen) {
  return fen.trim().split(/\s+/).slice(0, 4).join(" ");
}

function stripExtras(text) {
  return text
    .replace(/\{[^}]*\}/g, " ")
    .replace(/;.*$/gm, " ")
    .replace(/\([^()]*\)/g, " ")
    .replace(/\$\d+/g, " ")
    .replace(/[!?]+/g, " ")
    .replace(/\b(?:1-0|0-1|1\/2-1\/2|\*)\b/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applySanList(chess, text) {
  const tokens = stripExtras(text).split(" ").filter(Boolean);
  if (!tokens.length) {
    throw new Error("No moves were found in the text you pasted.");
  }
  for (const tok of tokens) {
    const moved = chess.move(tok, { strict: false });
    if (!moved) {
      throw new Error(`Could not play the move "${tok}". Check the move list or FEN.`);
    }
  }
}

/**
 * Load a game from a PGN, a plain SAN move list, and/or a starting FEN.
 * Returns { chess, headers, startFen, moves } where moves are verbose chess.js moves
 * plus fenBefore / fenAfter / uci / legalCount (legal moves before the ply).
 */
export function loadGame({ pgn = "", fen = "" } = {}) {
  const startFen = fen.trim();
  if (startFen) {
    const check = validateFen(startFen);
    if (!check.ok) {
      throw new Error(`Invalid FEN: ${check.error || "could not parse"}`);
    }
  }

  const text = (pgn || "").trim();
  const chess = startFen ? new Chess(startFen) : new Chess();
  let headers = {};

  if (text) {
    const looksLikePgn = /\[\s*\w+\s*["']/m.test(text) || /\d+\./.test(text);
    let loaded = false;
    if (looksLikePgn && !startFen) {
      try {
        chess.loadPgn(text, { strict: false });
        headers = chess.getHeaders() || {};
        loaded = true;
      } catch {
        loaded = false;
      }
    }
    if (!loaded) {
      applySanList(chess, text);
    }
  }

  const start = startFen || headers.FEN || START_FEN;
  return { headers, startFen: start, moves: collectMoves(start, chess) };
}

function copyHistory(from, to) {
  const verbose = from.history({ verbose: true });
  to.reset();
  if (from.header && from.getHeaders) {
    /* headers already on `from` only */
  }
  const fen = extractStartFen(from);
  if (fen && !isStartFen(fen)) to.load(fen);
  else to.reset();
  for (const m of verbose) to.move(m);
}

function extractStartFen() {
  return null;
}

function collectMoves(startFen, finalChess) {
  const verbose = finalChess.history({ verbose: true });
  const walker = startFen && !isStartFen(startFen) ? new Chess(startFen) : new Chess();
  const moves = [];
  for (const m of verbose) {
    const fenBefore = walker.fen();
    const legalCount = walker.moves().length;
    const played = walker.move({
      from: m.from,
      to: m.to,
      promotion: m.promotion,
    });
    const uci = m.from + m.to + (m.promotion || "");
    moves.push({
      san: played ? played.san : m.san,
      uci,
      from: m.from,
      to: m.to,
      promotion: m.promotion || null,
      color: m.color,
      piece: m.piece,
      captured: m.captured || null,
      fenBefore,
      fenAfter: walker.fen(),
      legalCount,
      ply: moves.length,
      moveNumber: m.color === "w" ? walker.moveNumber() - 0 : walker.moveNumber(),
    });
  }
  // Fix move numbers from the verbose objects.
  const numbered = startFen && !isStartFen(startFen) ? new Chess(startFen) : new Chess();
  for (const mv of moves) {
    mv.moveNumber = numbered.moveNumber();
    numbered.move(mv);
  }
  return moves;
}

export function playerNames(headers) {
  return {
    white: headers.White || headers.white || "White",
    black: headers.Black || headers.black || "Black",
    whiteElo: headers.WhiteElo || "",
    blackElo: headers.BlackElo || "",
    event: headers.Event || "",
    date: headers.Date || headers.UTCDate || "",
    result: headers.Result || "",
  };
}
