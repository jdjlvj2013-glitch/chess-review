import { test, expect, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fischerPgn = readFileSync(resolve(root, "games/byrne-fischer-1956.pgn"), "utf8");
const blunderPgn = readFileSync(resolve(root, "games/blunders.pgn"), "utf8");

async function analyzePgn(page, pgn, depth = "14") {
  await page.goto(`/?depth=${depth}`);
  await page.locator("#pgn-input").fill(pgn);
  await page.locator("#analyze-btn").click();
  await expect(page.locator("#review-panel")).toBeVisible();
  await page.waitForFunction(() => window.__chessReview && window.__chessReview.ready, null, {
    timeout: 11 * 60 * 1000,
  });
  return page.evaluate(() => window.__chessReview.getState());
}

test("blunder demo marks Qxe5+ as a blunder", async ({ page }) => {
  const state = await analyzePgn(page, blunderPgn, "12");
  const hang = state.reviews.find((m) => m && m.san === "Qxe5+" && m.color === "w");
  expect(hang, "3. Qxe5+ should be reviewed").toBeTruthy();
  expect(hang.classification).toBe("blunder");
  expect(state.summary.w.counts.blunder).toBeGreaterThanOrEqual(1);
});

test("Byrne vs Fischer 17...Be6 is Brilliant or at least Best/Great", async ({ page }) => {
  const state = await analyzePgn(page, fischerPgn, "14");
  const be6 = state.reviews.find((m) => m && m.san === "Be6" && m.color === "b" && m.moveNumber === 17);
  expect(be6, "17...Be6 should be reviewed").toBeTruthy();
  expect(["brilliant", "great", "best"]).toContain(be6.classification);

  await page.evaluate(() => {
    const recs = window.__chessReview.getState().reviews;
    const i = recs.findIndex((m) => m && m.san === "Be6" && m.color === "b" && m.moveNumber === 17);
    window.__chessReview.goTo(i + 1);
  });
  await expect(page.locator("#class-title .class-name")).toBeVisible();
  await expect(page.locator(".board-badge")).toBeVisible({ timeout: 2000 });
  await expect(page.locator("img[data-piece], .piece[data-piece='bB'], .piece[data-piece='wK']").first()).toBeVisible();
  await expect(page.locator(".piece[data-piece='wK'] img")).toHaveAttribute("src", /cburnett\/wK\.svg/);
  await page.screenshot({ path: resolve(root, "screenshot.png"), fullPage: true });
});

test("Play auto-plays, shows badges, Space pauses, and clicking a move pauses", async ({ page }) => {
  const state0 = await analyzePgn(page, blunderPgn, "12");
  expect(state0.moveCount).toBeGreaterThan(3);
  await page.click("#nav-start");
  await expect.poll(async () => page.evaluate(() => window.__chessReview.getState().ply)).toBe(0);
  await page.selectOption("#play-speed", "500");
  await page.click("#nav-play");
  await expect.poll(async () => page.evaluate(() => window.__chessReview.getState().playing)).toBe(true);
  await expect.poll(async () => page.evaluate(() => window.__chessReview.getState().ply)).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".board-badge")).toBeVisible();
  await page.keyboard.press("Space");
  await expect.poll(async () => page.evaluate(() => window.__chessReview.getState().playing)).toBe(false);
  const mid = await page.evaluate(() => window.__chessReview.getState().ply);
  expect(mid).toBeGreaterThanOrEqual(1);
  await page.click("#nav-play");
  await expect.poll(async () => page.evaluate(() => window.__chessReview.getState().playing)).toBe(true);
  await page.locator('.move-san[data-ply="1"]').click();
  await expect.poll(async () => page.evaluate(() => window.__chessReview.getState().playing)).toBe(false);
  expect(await page.evaluate(() => window.__chessReview.getState().ply)).toBe(1);
  await expect(page.locator(".board-badge")).toBeVisible();
  // Step backward and forward — badge should remain after the slide.
  await page.click("#nav-next");
  await page.waitForTimeout(350);
  await expect(page.locator(".board-badge")).toBeVisible();
});

async function assertPlaybackDoesNotScrollPage(page) {
  const state0 = await analyzePgn(page, blunderPgn, "12");
  expect(state0.moveCount).toBeGreaterThan(3);
  await page.evaluate(() => window.__chessReview.goTo(0, { instant: true }));
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  await expect.poll(async () => page.evaluate(() => window.scrollY || document.documentElement.scrollTop)).toBe(0);
  await page.selectOption("#play-speed", "500");
  await page.locator("#nav-play").click({ force: true });
  await expect.poll(async () => page.evaluate(() => window.__chessReview.getState().playing)).toBe(true);

  const start = Date.now();
  let lastPly = 0;
  while (Date.now() - start < 12000) {
    const { playing, ply, y } = await page.evaluate(() => ({
      playing: window.__chessReview.getState().playing,
      ply: window.__chessReview.getState().ply,
      y: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
    }));
    expect(y, `window scrolled to ${y} at ply ${ply}`).toBe(0);
    lastPly = ply;
    if (!playing && ply >= 1) break;
    await page.waitForTimeout(80);
  }
  expect(lastPly).toBeGreaterThanOrEqual(2);
  const finalY = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop || 0);
  expect(finalY).toBe(0);
}

test.describe("playback does not scroll the page", () => {
  test("desktop: Play keeps window.scrollY at 0", async ({ page }) => {
    await assertPlaybackDoesNotScrollPage(page);
  });
});

function phoneUse(device) {
  return {
    viewport: device.viewport,
    userAgent: device.userAgent,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
    deviceScaleFactor: device.deviceScaleFactor,
  };
}

test.describe("playback does not scroll the page on a phone", () => {
  test.use(phoneUse(devices["iPhone 13"]));
  test("iPhone: Play keeps window.scrollY at 0", async ({ page }) => {
    await assertPlaybackDoesNotScrollPage(page);
  });
});

test.describe("playback does not scroll the page on a Pixel", () => {
  test.use(phoneUse(devices["Pixel 7"]));
  test("Pixel: Play keeps window.scrollY at 0", async ({ page }) => {
    await assertPlaybackDoesNotScrollPage(page);
  });
});

function parseFenPieces(fen) {
  const FILES = "abcdefgh";
  const board = fen.split(" ")[0];
  const pieces = [];
  let r = 7;
  let f = 0;
  for (const ch of board) {
    if (ch === "/") {
      r -= 1;
      f = 0;
    } else if (/\d/.test(ch)) {
      f += Number(ch);
    } else {
      const color = ch === ch.toUpperCase() ? "w" : "b";
      pieces.push({ square: FILES[f] + (r + 1), type: ch.toLowerCase(), color, piece: color + ch.toUpperCase() });
      f += 1;
    }
  }
  return pieces;
}

async function assertPiecesMatchFen(page, label) {
  await page.evaluate(() => window.__chessReview.whenSettled());
  const result = await page.evaluate(() => {
    const fen = window.__chessReview.getFen();
    const ply = window.__chessReview.getState().ply;
    const FILES = "abcdefgh";
    const board = fen.split(" ")[0];
    const expected = [];
    let r = 7;
    let f = 0;
    for (const ch of board) {
      if (ch === "/") {
        r -= 1;
        f = 0;
      } else if (/\d/.test(ch)) {
        f += Number(ch);
      } else {
        const color = ch === ch.toUpperCase() ? "w" : "b";
        expected.push({ square: FILES[f] + (r + 1), color, type: ch.toLowerCase() });
        f += 1;
      }
    }
    const dom = window.__chessReview.getDomPieces();
    return { fen, ply, expected, dom };
  });
  const live = result.dom.filter((p) => !p.capturing);
  const bySquare = new Map();
  for (const p of live) {
    expect(p.square, `${label} ply ${result.ply}: piece without a square`).toBeTruthy();
    expect(bySquare.has(p.square), `${label} ply ${result.ply}: two pieces on ${p.square}`).toBe(false);
    bySquare.set(p.square, p);
  }
  expect(live.length, `${label} ply ${result.ply}: piece count ${live.length} vs ${result.expected.length}`).toBe(
    result.expected.length
  );
  for (const exp of result.expected) {
    const got = bySquare.get(exp.square);
    expect(got, `${label} ply ${result.ply}: missing ${exp.color}${exp.type} on ${exp.square}`).toBeTruthy();
    expect(got.color).toBe(exp.color);
    expect(got.type).toBe(exp.type);
  }
  expect(result.dom.some((p) => p.capturing), `${label} ply ${result.ply}: captured piece still in the DOM`).toBe(false);
}

test("piece DOM matches FEN after every Byrne vs Fischer ply", async ({ page }) => {
  const state = await analyzePgn(page, fischerPgn, "14");
  const total = state.moveCount;
  expect(total).toBe(82);

  // 1) Auto-play at 0.5s per move.
  await page.evaluate(() => window.__chessReview.goTo(0, { instant: true }));
  await page.evaluate(() => window.__chessReview.whenSettled());
  await page.selectOption("#play-speed", "500");
  await page.locator("#nav-play").click({ force: true });
  for (let ply = 1; ply <= total; ply++) {
    await expect.poll(async () => page.evaluate(() => window.__chessReview.getState().ply)).toBe(ply);
    await assertPiecesMatchFen(page, "play");
  }
  await expect.poll(async () => page.evaluate(() => window.__chessReview.getState().playing)).toBe(false);

  // 2) Step forward with arrow keys, including a burst of rapid presses.
  await page.evaluate(() => window.__chessReview.goTo(0, { instant: true }));
  await page.evaluate(() => window.__chessReview.whenSettled());
  await assertPiecesMatchFen(page, "start");
  for (let ply = 1; ply <= 20; ply++) {
    await page.keyboard.press("ArrowRight");
    await page.evaluate(() => window.__chessReview.whenSettled());
    expect(await page.evaluate(() => window.__chessReview.getState().ply)).toBe(ply);
    await assertPiecesMatchFen(page, "arrow");
  }
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("ArrowRight");
  }
  await page.evaluate(() => window.__chessReview.whenSettled());
  await assertPiecesMatchFen(page, "rapid");
  const afterBurst = await page.evaluate(() => window.__chessReview.getState().ply);
  expect(afterBurst).toBeGreaterThanOrEqual(50);
  while ((await page.evaluate(() => window.__chessReview.getState().ply)) < total) {
    await page.keyboard.press("ArrowRight");
    await page.evaluate(() => window.__chessReview.whenSettled());
    await assertPiecesMatchFen(page, "arrow-finish");
  }
  expect(await page.evaluate(() => window.__chessReview.getState().ply)).toBe(total);
  await assertPiecesMatchFen(page, "end");

  // 3) Step backward through the whole game, restoring captured pieces.
  for (let ply = total - 1; ply >= 0; ply--) {
    await page.keyboard.press("ArrowLeft");
    await page.evaluate(() => window.__chessReview.whenSettled());
    expect(await page.evaluate(() => window.__chessReview.getState().ply)).toBe(ply);
    await assertPiecesMatchFen(page, "back");
  }
});

test("en passant capture removes the pawn from its own square", async ({ page }) => {
  const pgn = "1. e4 d5 2. e5 f5 3. exf6";
  await analyzePgn(page, pgn, "12");
  await page.evaluate(() => window.__chessReview.goTo(0, { instant: true }));
  for (let ply = 1; ply <= 5; ply++) {
    await page.keyboard.press("ArrowRight");
    await page.evaluate(() => window.__chessReview.whenSettled());
    await assertPiecesMatchFen(page, "ep-forward");
  }
  const after = await page.evaluate(() => window.__chessReview.getDomPieces());
  expect(after.find((p) => p.square === "f5")).toBeFalsy();
  expect(after.find((p) => p.square === "f6" && p.color === "w" && p.type === "p")).toBeTruthy();
  await page.keyboard.press("ArrowLeft");
  await page.evaluate(() => window.__chessReview.whenSettled());
  await assertPiecesMatchFen(page, "ep-back");
  const undone = await page.evaluate(() => window.__chessReview.getDomPieces());
  expect(undone.find((p) => p.square === "f5" && p.color === "b" && p.type === "p")).toBeTruthy();
  expect(undone.find((p) => p.square === "e5" && p.color === "w" && p.type === "p")).toBeTruthy();
});
