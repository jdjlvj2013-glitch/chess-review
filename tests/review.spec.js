import { test, expect } from "@playwright/test";
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
