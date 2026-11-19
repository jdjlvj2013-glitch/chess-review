import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGame } from "../js/game.js";
import { isBookMove } from "../js/openings.js";

const fischer = readFileSync(new URL("../games/byrne-fischer-1956.pgn", import.meta.url), "utf8");
const blunders = readFileSync(new URL("../games/blunders.pgn", import.meta.url), "utf8");

test("loads the Byrne–Fischer PGN and finds 17...Be6", () => {
  const game = loadGame({ pgn: fischer });
  assert.equal(game.headers.White, "Donald Byrne");
  assert.equal(game.headers.Black, "Robert James Fischer");
  assert.equal(game.moves.length, 82);
  const be6 = game.moves.find((m) => m.color === "b" && m.moveNumber === 17 && m.san === "Be6");
  assert.ok(be6, "17...Be6 should be in the game");
  assert.equal(be6.uci, "g4e6");
});

test("loads a plain SAN move list", () => {
  const game = loadGame({ pgn: "1. e4 e5 2. Nf3 Nc6" });
  assert.deepEqual(game.moves.map((m) => m.san), ["e4", "e5", "Nf3", "Nc6"]);
});

test("loads a move list from a custom FEN", () => {
  const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";
  const game = loadGame({ pgn: "Nf3 Nc6", fen });
  assert.equal(game.moves.length, 2);
  assert.equal(game.moves[0].san, "Nf3");
});

test("rejects a bad FEN", () => {
  assert.throws(() => loadGame({ fen: "not-a-fen" }), /Invalid FEN/);
});

test("early Fischer moves are book, 17...Be6 is not", () => {
  const game = loadGame({ pgn: fischer });
  const first = game.moves[0];
  assert.equal(isBookMove(game.startFen, ["Nf3"]), true);
  const hist = [];
  let bookEnd = 0;
  for (const m of game.moves) {
    hist.push(m.san);
    if (isBookMove(game.startFen, hist)) bookEnd = m.moveNumber;
  }
  assert.ok(bookEnd >= 4);
  const be6Hist = game.moves.filter((m) => m.moveNumber < 17 || (m.moveNumber === 17 && m.color === "w")).map((m) => m.san);
  be6Hist.push("Be6");
  assert.equal(isBookMove(game.startFen, be6Hist), false);
});

test("blunder demo includes Qxe5+", () => {
  const game = loadGame({ pgn: blunders });
  assert.equal(game.moves[4].san, "Qxe5+");
  assert.equal(game.moves[4].color, "w");
});
