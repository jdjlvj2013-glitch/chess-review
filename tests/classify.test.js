import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baseClassification,
  classifyMove,
  expectedPoints,
  moveAccuracy,
  playerAccuracy,
} from "../js/classify.js";

test("logistic expected points is 0.5 at 0 cp and rises with advantage", () => {
  assert.equal(Number(expectedPoints({ cp: 0 }).toFixed(4)), 0.5);
  assert.ok(expectedPoints({ cp: 200 }) > 0.67 && expectedPoints({ cp: 200 }) < 0.69);
  assert.ok(expectedPoints({ mate: 2 }) > 0.99);
  assert.ok(expectedPoints({ mate: -1 }) < 0.01);
});

test("base cutoffs follow the published expected-points table", () => {
  assert.equal(baseClassification(0, { isEngineBest: true }), "best");
  assert.equal(baseClassification(0.004), "best");
  assert.equal(baseClassification(0.015), "excellent");
  assert.equal(baseClassification(0.03), "good");
  assert.equal(baseClassification(0.08), "inaccuracy");
  assert.equal(baseClassification(0.15), "mistake");
  assert.equal(baseClassification(0.25), "blunder");
});

test("book moves are tagged book and score 100 accuracy", () => {
  const r = classifyMove({
    playedUci: "e2e4",
    bestUci: "e2e4",
    bestScore: { cp: 30 },
    playedScore: { cp: 30 },
    isBook: true,
    legalMoveCount: 20,
  });
  assert.equal(r.classification, "book");
  assert.equal(r.accuracy, 100);
});

test("a sound piece sacrifice that is best is Brilliant", () => {
  const r = classifyMove({
    playedUci: "c8e6",
    bestUci: "c8e6",
    bestScore: { cp: 200 },
    playedScore: { cp: 200 },
    secondBestScore: { cp: -150 },
    legalMoveCount: 20,
    isBook: false,
    materialOffer: 9,
  });
  assert.equal(r.classification, "brilliant");
});

test("an already trivial win is not Brilliant", () => {
  const r = classifyMove({
    playedUci: "a1a8",
    bestUci: "a1a8",
    bestScore: { cp: 800 },
    playedScore: { cp: 800 },
    secondBestScore: { cp: 700 },
    legalMoveCount: 20,
    materialOffer: 5,
  });
  assert.equal(r.classification, "best");
});

test("the only good move is Great when it is not a sacrifice", () => {
  const r = classifyMove({
    playedUci: "e2e4",
    bestUci: "e2e4",
    bestScore: { cp: 40 },
    playedScore: { cp: 40 },
    secondBestScore: { cp: -250 },
    legalMoveCount: 15,
    materialOffer: 0,
  });
  assert.equal(r.classification, "great");
});

test("failing to punish a blunder is a Miss", () => {
  const r = classifyMove({
    playedUci: "a2a3",
    bestUci: "d1d8",
    bestScore: { cp: 400 },
    playedScore: { cp: 20 },
    secondBestScore: { cp: 30 },
    legalMoveCount: 20,
    opponentPrevClass: "blunder",
    materialOffer: 0,
  });
  assert.equal(r.classification, "miss");
});

test("hanging a queen is a Blunder", () => {
  const r = classifyMove({
    playedUci: "d1e5",
    bestUci: "f1c4",
    bestScore: { cp: 50 },
    playedScore: { cp: -800 },
    secondBestScore: { cp: 40 },
    legalMoveCount: 30,
    materialOffer: 0,
  });
  assert.equal(r.classification, "blunder");
});

test("accuracy formula is in range and rewards low loss", () => {
  const perfect = moveAccuracy(0);
  const mid = moveAccuracy(10);
  assert.ok(perfect > 99 && perfect <= 100);
  assert.ok(mid > 60 && mid < 75);
  assert.ok(playerAccuracy([0, 0, 10]) < 100);
  assert.ok(playerAccuracy([0, 0, 10]) > 80);
});
