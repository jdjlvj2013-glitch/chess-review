/**
 * A compact opening book used to tag early theory moves as Book.
 * Lines are SAN from the standard starting position. A position is book
 * if its SAN history is a prefix of one of these lines.
 */
import { isStartFen, normalizeFen } from "./game.js";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";

const LINES = [
  // Open games
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3",
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4 b5 Bb3 d5 dxe5",
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O",
  "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxb5",
  "e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Bc5",
  "e4 e5 Nf3 Nc6 Bb5 Bc5 c3 Nf6 d4",
  "e4 e5 Nf3 Nc6 Bb5 f5",
  "e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5",
  "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5",
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4",
  "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3",
  "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5",
  "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6",
  "e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O",
  "e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4 Nxd4",
  "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5",
  "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 Qe2",
  "e4 e5 Nf3 d6 d4 Nd7",
  "e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6",
  "e4 e5 Nc3 Nf6 f4 d5",
  "e4 e5 Nc3 Nc6 f4 exf4 Nf3",
  "e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5",
  "e4 e5 f4 Bc5 Nf3 d6",
  "e4 e5 f4 d5 exd5 e4",
  "e4 e5 d4 exd4 Qxd4 Nc6",
  "e4 e5 Bc4 Nf6 d3",
  "e4 e5 Bc4 Bc5",
  // Sicilian
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6",
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6",
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5",
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 e6 Nc3 Qc7",
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6",
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6",
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6",
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 d6",
  "e4 c5 Nf3 Nf6 e5 Nd5 Nc3 e6",
  "e4 c5 c3 Nf6 e5 Nd5 d4",
  "e4 c5 c3 d5 exd5 Qxd5 d4",
  "e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7",
  "e4 c5 Nc3 Nc6 f4 g6 Nf3 Bg7",
  "e4 c5 d4 cxd4 c3",
  "e4 c5 b4",
  // French, Caro-Kann, Pirc, Modern, Scandi, Alekhine
  "e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+",
  "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7",
  "e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7",
  "e4 e6 d4 d5 Nd2 c5 exd5 exd5",
  "e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3",
  "e4 e6 d4 d5 exd5 exd5 Nf3 Nf6",
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5",
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7",
  "e4 c6 d4 d5 e5 Bf5 Nf3 e6",
  "e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6",
  "e4 c6 Nf3 d5 Nc3",
  "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7",
  "e4 d6 d4 Nf6 Nc3 g6 f4 Bg7 Nf3",
  "e4 g6 d4 Bg7 Nc3 d6",
  "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6",
  "e4 d5 exd5 Nf6 d4 Nxd5 Nf3",
  "e4 Nf6 e5 Nd5 d4 d6 Nf3",
  "e4 Nf6 e5 Nd5 c4 Nb6",
  "e4 b6 d4 Bb7 Bd3",
  "e4 Nc6 d4 d5",
  // Queen's pawn, Queen's Gambit, Slav, Nimzo, QI, KI, Grunfeld, Dutch, Benoni
  "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7",
  "d4 d5 c4 e6 Nc3 Nf6 Nf3 Be7",
  "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5",
  "d4 d5 c4 e6 Nf3 Nf6 g3 Be7 Bg2 O-O",
  "d4 d5 c4 e6 Nf3 Nf6 Bg5 Bb4",
  "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4",
  "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7",
  "d4 d5 c4 c6 cxd5 cxd5 Nc3 Nf6",
  "d4 d5 c4 dxc4 e4 e5",
  "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4",
  "d4 d5 Nf3 Nf6 c4 e6",
  "d4 d5 Nf3 Nf6 Bf4 c5 e3",
  "d4 d5 Nf3 Nf6 Bg5",
  "d4 d5 Bf4 Nf6 e3 c5",
  "d4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3",
  "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5",
  "d4 Nf6 c4 e6 Nc3 Bb4 e3 c5",
  "d4 Nf6 c4 e6 Nf3 b6 g3 Ba6",
  "d4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2",
  "d4 Nf6 c4 e6 Nf3 Bb4+ Bd2 Qe7",
  "d4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3",
  "d4 Nf6 c4 e6 g3 c5 Nf3 d5",
  "d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7",
  "d4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7 Qb3 dxc4",
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5",
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3",
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Be2 O-O Bg5",
  "d4 Nf6 c4 g6 Nf3 Bg7 g3 O-O Bg2 d6",
  "d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6",
  "d4 Nf6 c4 c5 d5 b5 cxb5 a6",
  "d4 Nf6 Nf3 g6 c4 Bg7 Nc3 O-O",
  "d4 Nf6 Nf3 g6 g3 Bg7 Bg2 O-O",
  "d4 Nf6 Nf3 e6 c4 b6",
  "d4 Nf6 Nf3 d5 c4",
  "d4 Nf6 Nf3 d5 Bf4",
  "d4 Nf6 Bf4 g6 e3 Bg7",
  "d4 Nf6 Bf4 d5 e3 e6",
  "d4 f5 c4 Nf6 g3 e6 Bg2",
  "d4 f5 c4 Nf6 Nf3 g6",
  "d4 d6 e4 Nf6 Nc3 g6",
  "d4 e6 c4 f5",
  "d4 e5 dxe5 Nc6 Nf3 Qe7",
  // English, Reti, and the Byrne–Fischer start (Nf3 Nf6 c4 g6)
  "c4 e5 Nc3 Nf6 Nf3 Nc6",
  "c4 e5 Nc3 Nf6 g3",
  "c4 e5 g3 Nf6 Bg2",
  "c4 c5 Nc3 Nc6 g3 g6",
  "c4 c5 Nf3 Nf6 g3 b6 Bg2 Bb7",
  "c4 Nf6 Nc3 e6 Nf3 d5",
  "c4 Nf6 Nc3 g6 g3 Bg7 Bg2 O-O",
  "c4 e6 Nf3 d5 g3 Nf6 Bg2",
  "Nf3 Nf6 c4 g6 Nc3 Bg7 d4 O-O Bf4 d5",
  "Nf3 Nf6 c4 e6 g3 d5 Bg2 Be7",
  "Nf3 Nf6 c4 c5 Nc3 Nc6",
  "Nf3 d5 c4 e6 g3 Nf6",
  "Nf3 d5 g3 Nf6 Bg2 c6",
  "Nf3 Nf6 g3 g6 Bg2 Bg7 O-O O-O",
  "Nf3 f5 g3 Nf6 Bg2",
  "g3 d5 Bg2 Nf6 Nf3",
  "b3 e5 Bb2 Nc6",
];

let prefixSet = null;

function buildPrefixes() {
  if (prefixSet) return prefixSet;
  prefixSet = new Set([""]);
  for (const line of LINES) {
    const moves = line.trim().split(/\s+/);
    let acc = [];
    for (const m of moves) {
      acc.push(m);
      prefixSet.add(acc.join(" "));
    }
  }
  return prefixSet;
}

export function isBookMove(startFen, sanHistoryIncludingThis) {
  if (startFen && !isStartFen(startFen) && normalizeFen(startFen) !== START) {
    return false;
  }
  const key = sanHistoryIncludingThis.join(" ");
  return buildPrefixes().has(key);
}

export const BOOK_LINE_COUNT = LINES.length;
