import { Chess } from "../vendor/chess.js";
import {
  CLASS_META,
  CLASS_ORDER,
  classifyMove,
  expectedPoints,
  flipScore,
  formatScore,
  materialOffer,
  summarize,
} from "./classify.js";
import { StockfishEngine, uciToFromTo } from "./engine.js";
import { loadGame, playerNames } from "./game.js";
import { isBookMove } from "./openings.js";
import { BoardView } from "./board.js";

const DEFAULT_DEPTH = 18;
const SAMPLE_URLS = {
  fischer: "games/byrne-fischer-1956.pgn",
  blunders: "games/blunders.pgn",
};

const els = {
  importPanel: document.getElementById("import-panel"),
  reviewPanel: document.getElementById("review-panel"),
  pgnInput: document.getElementById("pgn-input"),
  fenInput: document.getElementById("fen-input"),
  fileInput: document.getElementById("pgn-file"),
  depth: document.getElementById("depth"),
  analyzeBtn: document.getElementById("analyze-btn"),
  error: document.getElementById("import-error"),
  progressWrap: document.getElementById("progress-wrap"),
  progressBar: document.getElementById("progress-bar"),
  progressText: document.getElementById("progress-text"),
  board: document.getElementById("board"),
  evalFill: document.getElementById("eval-fill"),
  evalLabel: document.getElementById("eval-label"),
  plyLabel: document.getElementById("ply-label"),
  whiteName: document.getElementById("white-name"),
  blackName: document.getElementById("black-name"),
  whiteAcc: document.getElementById("white-accuracy"),
  blackAcc: document.getElementById("black-accuracy"),
  whiteCounts: document.getElementById("white-counts"),
  blackCounts: document.getElementById("black-counts"),
  graph: document.getElementById("eval-graph"),
  moveList: document.getElementById("move-list"),
  classTitle: document.getElementById("class-title"),
  classDetail: document.getElementById("class-detail"),
  bestLine: document.getElementById("best-line"),
  eventMeta: document.getElementById("event-meta"),
  newGame: document.getElementById("new-game"),
  flip: document.getElementById("flip-board"),
  start: document.getElementById("nav-start"),
  prev: document.getElementById("nav-prev"),
  next: document.getElementById("nav-next"),
  end: document.getElementById("nav-end"),
  play: document.getElementById("nav-play"),
  playSpeed: document.getElementById("play-speed"),
};

const state = {
  headers: {},
  startFen: "",
  moves: [],
  positions: [], // analysis of each fen, index 0 = start
  reviews: [],
  ply: 0, // 0 = start position, i = after move i-1
  analyzing: false,
  canceled: false,
  names: { white: "White", black: "Black" },
  summary: null,
  playing: false,
  playSpeed: 1000,
};

const engine = new StockfishEngine();
const board = new BoardView(els.board);

function showError(msg) {
  els.error.textContent = msg || "";
  els.error.hidden = !msg;
}

function setProgress(done, total, extra = "") {
  const pct = total ? Math.round((done / total) * 100) : 0;
  els.progressWrap.hidden = false;
  els.progressBar.style.width = `${pct}%`;
  els.progressText.textContent = extra || `Analyzing ${done} / ${total}`;
}

async function loadSample(key) {
  const url = SAMPLE_URLS[key];
  const text = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Could not load ${url}`);
    return r.text();
  });
  els.pgnInput.value = text;
  els.fenInput.value = "";
}

async function startReview() {
  showError("");
  let game;
  try {
    game = loadGame({ pgn: els.pgnInput.value, fen: els.fenInput.value });
  } catch (err) {
    showError(err.message || String(err));
    return;
  }
  if (!game.moves.length) {
    showError("Paste a PGN or a move list first.");
    return;
  }

  const depth = Number(els.depth.value) || DEFAULT_DEPTH;
  state.headers = game.headers;
  state.startFen = game.startFen;
  state.moves = game.moves;
  state.positions = new Array(game.moves.length + 1).fill(null);
  state.reviews = new Array(game.moves.length).fill(null);
  state.ply = 0;
  state.analyzing = true;
  state.canceled = false;
  state.names = playerNames(game.headers);
  state.summary = null;
  pausePlayback();

  els.importPanel.hidden = true;
  els.reviewPanel.hidden = false;
  els.progressWrap.hidden = false;
  renderMeta();
  renderAll();

  try {
    await engine.init();
    const total = game.moves.length + 1;
    for (let i = 0; i < total; i++) {
      if (state.canceled) return;
      const fen = i === 0 ? game.moves[0].fenBefore : game.moves[i - 1].fenAfter;
      setProgress(i, total, `Analyzing position ${i + 1} of ${total} (depth ${depth})`);
      const result = await engine.analyze(fen, { depth, multiPv: 3 });
      state.positions[i] = result;
      if (i > 0) {
        state.reviews[i - 1] = reviewMove(i - 1);
        state.summary = summarize(state.reviews.filter(Boolean));
      }
      if (state.ply === 0 && i === 1) state.ply = 1;
      renderAll({ type: "none" });
    }
    setProgress(total, total, "Analysis complete");
    setTimeout(() => {
      if (!state.analyzing) els.progressWrap.hidden = true;
    }, 800);
  } catch (err) {
    showError(err.message || String(err));
    els.importPanel.hidden = false;
  } finally {
    state.analyzing = false;
    if (state.reviews.every(Boolean)) {
      els.progressWrap.hidden = true;
    }
    renderAll();
    exposeDebug();
  }
}

function sanHistory(upToIndexInclusive) {
  return state.moves.slice(0, upToIndexInclusive + 1).map((m) => m.san);
}

function reviewMove(index) {
  const move = state.moves[index];
  const before = state.positions[index];
  const after = state.positions[index + 1];
  const best = before?.lines?.[0];
  const second = before?.lines?.[1];
  const bestScore = best?.score || { cp: 0 };
  const bestUci = before?.bestMove || best?.pv?.[0] || "";
  const playedFromOpp = after?.lines?.[0]?.score || { cp: 0 };
  const playedScore = flipScore(playedFromOpp);

  const book = isBookMove(state.startFen, sanHistory(index));

  let offer = 0;
  try {
    const pos = new Chess(move.fenAfter);
    offer = materialOffer(pos, move.color);
  } catch {
    offer = 0;
  }

  const prev = index > 0 ? state.reviews[index - 1] : null;
  const classified = classifyMove({
    playedUci: move.uci,
    bestUci,
    bestScore,
    playedScore,
    secondBestScore: second ? second.score : null,
    legalMoveCount: move.legalCount,
    isBook: book,
    opponentPrevClass: prev ? prev.classification : null,
    materialOffer: offer,
  });

  return {
    ...move,
    ...classified,
    bestUci,
    bestPv: best?.pv || [],
    bestScore,
    playedScore,
    materialOffer: offer,
  };
}

function currentReview() {
  if (state.ply <= 0) return null;
  return state.reviews[state.ply - 1] || null;
}

function currentFen() {
  if (!state.moves.length) return "8/8/8/8/8/8/8/8 w - - 0 1";
  if (state.ply <= 0) return state.moves[0].fenBefore;
  return state.moves[state.ply - 1].fenAfter;
}

function fenAtPly(ply) {
  if (!state.moves.length) return null;
  if (ply <= 0) return state.moves[0].fenBefore;
  return state.moves[ply - 1].fenAfter;
}

function whiteScoreAtPly(ply) {
  const fen = fenAtPly(ply);
  if (!fen) return null;
  try {
    const pos = new Chess(fen);
    if (pos.isCheckmate()) return pos.turn() === "w" ? { mate: -1 } : { mate: 1 };
    if (pos.isDraw()) return { cp: 0 };
  } catch {
    /* fall through to engine score */
  }
  const analyzed = state.positions[ply];
  if (!analyzed || !analyzed.lines || !analyzed.lines[0]) return null;
  const score = analyzed.lines[0].score;
  const side = fen.split(" ")[1];
  return side === "b" ? flipScore(score) : score;
}

function currentEvalWhite() {
  return whiteScoreAtPly(state.ply);
}

function renderMeta() {
  els.whiteName.textContent = state.names.white;
  els.blackName.textContent = state.names.black;
  const bits = [state.names.event, state.names.date, state.names.result].filter(Boolean);
  els.eventMeta.textContent = bits.join(" · ");
}

function renderBoard(transition = { type: "none" }) {
  const fen = currentFen();
  const mv = state.ply > 0 ? state.moves[state.ply - 1] : null;
  const rev = currentReview();
  let badge = null;
  if (rev && rev.classification) {
    const meta = CLASS_META[rev.classification];
    badge = { square: rev.to, classification: rev.classification, color: meta.color, symbol: meta.badge };
  }
  let bestArrow = null;
  if (rev && rev.bestUci && rev.bestUci !== rev.uci) {
    bestArrow = uciToFromTo(rev.bestUci);
  } else if (state.ply === 0 && state.positions[0]?.bestMove) {
    bestArrow = uciToFromTo(state.positions[0].bestMove);
  }
  board.update({
    fen,
    lastMove: mv ? { from: mv.from, to: mv.to } : null,
    badge,
    bestArrow,
    transition,
  });

  const ev = currentEvalWhite();
  const ep = ev ? expectedPoints(ev) : 0.5;
  els.evalFill.style.height = `${ep * 100}%`;
  els.evalLabel.textContent = ev ? formatScore(ev, { whitePov: true }) : "0.00";
  els.evalLabel.classList.toggle("black-ahead", ev && expectedPoints(ev) < 0.5);

  const total = state.moves.length;
  if (state.ply === 0) els.plyLabel.textContent = "Start";
  else {
    const m = state.moves[state.ply - 1];
    const num = m.moveNumber;
    const dots = m.color === "w" ? "." : "...";
    els.plyLabel.textContent = `${num}${dots} ${m.san}  (${state.ply}/${total})`;
  }
}

function renderAccuracy() {
  const summary = state.summary;
  const w = summary ? Math.round(summary.w.accuracy) : "–";
  const b = summary ? Math.round(summary.b.accuracy) : "–";
  els.whiteAcc.textContent = typeof w === "number" ? `${w}%` : w;
  els.blackAcc.textContent = typeof b === "number" ? `${b}%` : b;
  els.whiteCounts.innerHTML = renderCounts(summary?.w.counts);
  els.blackCounts.innerHTML = renderCounts(summary?.b.counts);
}

function renderCounts(counts) {
  if (!counts) return `<span class="muted">Waiting for analysis…</span>`;
  return CLASS_ORDER.map((id) => {
    const n = counts[id] || 0;
    const meta = CLASS_META[id];
    return `<div class="count-row" data-class="${id}">
      <span class="class-pill" style="--c:${meta.color}">${meta.badge}</span>
      <span class="count-label">${meta.label}</span>
      <span class="count-num">${n}</span>
    </div>`;
  }).join("");
}

function renderMoveInfo() {
  const rev = currentReview();
  if (state.ply === 0) {
    els.classTitle.innerHTML = `<span class="muted">Starting position</span>`;
    const ev = currentEvalWhite();
    els.classDetail.textContent = ev
      ? `Engine evaluation: ${formatScore(ev, { whitePov: true })} (White).`
      : "Waiting for the engine…";
    const pv = state.positions[0]?.lines?.[0]?.pv;
    els.bestLine.textContent = pv ? formatPv(currentFen(), pv) : "";
    return;
  }
  if (!rev) {
    els.classTitle.innerHTML = `<span class="muted">Not yet analyzed</span>`;
    els.classDetail.textContent = "The engine is still working through this position.";
    els.bestLine.textContent = "";
    return;
  }
  const meta = CLASS_META[rev.classification];
  const player = rev.color === "w" ? state.names.white : state.names.black;
  els.classTitle.innerHTML = `<span class="class-pill lg" style="--c:${meta.color}">${meta.badge}</span>
    <span class="class-name" style="color:${meta.color}">${meta.label}</span>
    <span class="class-san">${rev.san}</span>`;
  const lossPct = (rev.epLoss * 100).toFixed(1);
  const played = formatScore(rev.playedScore);
  const best = formatScore(rev.bestScore);
  let detail = `${player} played ${rev.san}. Expected points lost: ${lossPct}%. Eval after the move: ${played} (player’s view). Best was ${best}.`;
  if (rev.classification === "brilliant") {
    detail += " This is a sound piece sacrifice that stays the best (or nearly best) move.";
  } else if (rev.classification === "miss") {
    detail += " The opponent had just gone wrong, and this missed a chance to take a winning position.";
  } else if (rev.classification === "book") {
    detail += " This follows the bundled opening book.";
  }
  els.classDetail.textContent = detail;
  if (rev.bestUci && rev.bestUci !== rev.uci) {
    els.bestLine.textContent = "Best line: " + formatPv(rev.fenBefore, rev.bestPv);
  } else if (rev.bestPv?.length) {
    els.bestLine.textContent = "Best line: " + formatPv(rev.fenBefore, rev.bestPv);
  } else {
    els.bestLine.textContent = "";
  }
}

function formatPv(fen, pv) {
  if (!pv || !pv.length) return "";
  try {
    const c = new Chess(fen);
    const sans = [];
    let i = 0;
    for (const uci of pv.slice(0, 12)) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.slice(4) || undefined;
      const side = c.turn();
      const num = c.moveNumber();
      const mv = c.move({ from, to, promotion });
      if (!mv) break;
      if (side === "w") sans.push(`${num}. ${mv.san}`);
      else sans.push(i === 0 ? `${num}... ${mv.san}` : mv.san);
      i += 1;
    }
    if (pv.length > 12) sans.push("…");
    return sans.join(" ");
  } catch {
    return pv.slice(0, 12).join(" ");
  }
}

function moveListSignature() {
  return state.moves.map((m, i) => `${m.san}:${state.reviews[i]?.classification || ""}`).join("|");
}

function renderMoveList() {
  const sig = moveListSignature();
  const buttons = els.moveList.querySelectorAll(".move-san");
  if (els.moveList.dataset.sig === sig && buttons.length === state.moves.length) {
    buttons.forEach((btn) => {
      const ply = Number(btn.getAttribute("data-ply"));
      btn.classList.toggle("active", state.ply === ply);
    });
    const active = els.moveList.querySelector(".move-san.active");
    if (active) active.scrollIntoView({ block: "nearest" });
    return;
  }
  const parts = [];
  for (let i = 0; i < state.moves.length; i++) {
    const m = state.moves[i];
    const rev = state.reviews[i];
    if (m.color === "w" || i === 0) {
      if (m.color === "b" && i === 0) {
        parts.push(`<span class="move-num">${m.moveNumber}.</span>`);
        parts.push(`<span class="move-blank">…</span>`);
      } else if (m.color === "w") {
        parts.push(`<span class="move-num">${m.moveNumber}.</span>`);
      }
    }
    const meta = rev ? CLASS_META[rev.classification] : null;
    const active = state.ply - 1 === i ? " active" : "";
    const symbol = meta ? `<span class="move-sym" style="color:${meta.color}">${meta.symbol}</span>` : "";
    const cls = rev ? ` class-${rev.classification}` : "";
    parts.push(
      `<button type="button" class="move-san${active}${cls}" data-ply="${i + 1}" data-class="${rev ? rev.classification : ""}" data-san="${m.san}" style="${meta ? `--c:${meta.color}` : ""}">${m.san}${symbol}</button>`
    );
  }
  els.moveList.innerHTML = parts.join("");
  els.moveList.dataset.sig = sig;
  const active = els.moveList.querySelector(".move-san.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function renderGraph() {
  const svg = els.graph;
  const w = 320;
  const h = 88;
  const pad = 6;
  const n = state.moves.length;
  if (!n) {
    svg.innerHTML = "";
    return;
  }
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const score = whiteScoreAtPly(i);
    let ep = 0.5;
    if (score) {
      ep = expectedPoints(score);
    } else if (i > 0 && !state.positions[i]) {
      break;
    }
    const x = pad + (i / n) * (w - pad * 2);
    const y = pad + (1 - ep) * (h - pad * 2);
    pts.push({ x, y, ply: i, ep });
  }
  if (pts.length < 1) {
    svg.innerHTML = "";
    return;
  }
  const midY = pad + 0.5 * (h - pad * 2);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaTop = `M${pts[0].x.toFixed(1)},${midY} ` + pts.map((p) => `L${p.x.toFixed(1)},${Math.min(p.y, midY).toFixed(1)}`).join(" ") + ` L${pts.at(-1).x.toFixed(1)},${midY} Z`;
  const areaBot = `M${pts[0].x.toFixed(1)},${midY} ` + pts.map((p) => `L${p.x.toFixed(1)},${Math.max(p.y, midY).toFixed(1)}`).join(" ") + ` L${pts.at(-1).x.toFixed(1)},${midY} Z`;
  const cur = pts[Math.min(state.ply, pts.length - 1)];
  const sig = `${n}:${line}`;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  if (svg.dataset.sig !== sig) {
    svg.innerHTML = `
      <rect class="graph-bg" x="0" y="0" width="${w}" height="${h}" rx="8"/>
      <line class="graph-mid" x1="${pad}" x2="${w - pad}" y1="${midY}" y2="${midY}"/>
      <path class="graph-area white" d="${areaTop}"/>
      <path class="graph-area black" d="${areaBot}"/>
      <path class="graph-line" d="${line}"/>
      <line class="graph-cursor" x1="${cur.x}" x2="${cur.x}" y1="${pad}" y2="${h - pad}"/>
      <circle class="graph-dot" cx="${cur.x}" cy="${cur.y}" r="3.2"/>
    `;
    svg.dataset.sig = sig;
  } else {
    const cursor = svg.querySelector(".graph-cursor");
    const dot = svg.querySelector(".graph-dot");
    if (cursor) {
      cursor.setAttribute("x1", String(cur.x));
      cursor.setAttribute("x2", String(cur.x));
    }
    if (dot) {
      dot.setAttribute("cx", String(cur.x));
      dot.setAttribute("cy", String(cur.y));
    }
  }
  svg.onclick = (ev) => {
    const rect = svg.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * w;
    let best = 0;
    let dist = Infinity;
    for (const p of pts) {
      const d = Math.abs(p.x - x);
      if (d < dist) {
        dist = d;
        best = p.ply;
      }
    }
    goTo(best);
  };
}

function renderAll(transition = { type: "none" }) {
  renderBoard(transition);
  renderAccuracy();
  renderMoveInfo();
  renderMoveList();
  renderGraph();
  updatePlayButton();
  exposeDebug();
}

function goTo(ply, opts = {}) {
  const target = Math.max(0, Math.min(state.moves.length, ply));
  if (!opts.fromPlay) pausePlayback();
  const from = state.ply;
  if (target === from) {
    if (!opts.silent) renderAll({ type: "none" });
    return;
  }
  const delta = target - from;
  let transition;
  if (opts.instant || opts.animate === "none") transition = { type: "none" };
  else if (Math.abs(delta) === 1) {
    transition = {
      type: "move",
      move: state.moves[delta > 0 ? from : target],
      reverse: delta < 0,
      duration: 260,
    };
  } else {
    transition = { type: "fade", duration: 160 };
  }
  state.ply = target;
  renderAll(transition);
}

let playTimer = 0;

function pausePlayback() {
  if (playTimer) {
    window.clearTimeout(playTimer);
    playTimer = 0;
  }
  const was = state.playing;
  state.playing = false;
  if (was) updatePlayButton();
}

function updatePlayButton() {
  if (!els.play) return;
  els.play.textContent = state.playing ? "❚❚ Pause" : "▶ Play";
  els.play.setAttribute("aria-pressed", state.playing ? "true" : "false");
  els.play.title = state.playing ? "Pause (Space)" : "Play (Space)";
}

function playTick() {
  playTimer = 0;
  if (!state.playing) return;
  if (state.ply >= state.moves.length) {
    pausePlayback();
    return;
  }
  goTo(state.ply + 1, { fromPlay: true });
  if (state.ply >= state.moves.length) {
    pausePlayback();
    return;
  }
  playTimer = window.setTimeout(playTick, state.playSpeed);
}

function togglePlay() {
  if (state.playing) {
    pausePlayback();
    return;
  }
  if (!state.moves.length || els.reviewPanel.hidden) return;
  if (state.ply >= state.moves.length) {
    goTo(0, { instant: true });
  }
  state.playing = true;
  state.playSpeed = Number(els.playSpeed?.value) || 1000;
  updatePlayButton();
  playTick();
}

function exposeDebug() {
  window.__chessReview = {
    getState: () => ({
      ply: state.ply,
      moveCount: state.moves.length,
      analyzing: state.analyzing,
      reviews: state.reviews.map((r) =>
        r
          ? {
              san: r.san,
              color: r.color,
              moveNumber: r.moveNumber,
              classification: r.classification,
              epLoss: r.epLoss,
              wpLoss: r.wpLoss,
              accuracy: r.accuracy,
              bestUci: r.bestUci,
              uci: r.uci,
              materialOffer: r.materialOffer,
            }
          : null
      ),
      summary: state.summary,
      names: state.names,
      playing: state.playing,
      playSpeed: state.playSpeed,
    }),
    goTo,
    togglePlay,
    pausePlayback,
    ready: !state.analyzing && state.reviews.length > 0 && state.reviews.every(Boolean),
  };
}

function resetToImport() {
  pausePlayback();
  state.canceled = true;
  engine.stop();
  state.moves = [];
  state.reviews = [];
  state.positions = [];
  state.ply = 0;
  state.analyzing = false;
  els.reviewPanel.hidden = true;
  els.importPanel.hidden = false;
  els.progressWrap.hidden = true;
  showError("");
  exposeDebug();
}

els.analyzeBtn.addEventListener("click", startReview);
els.fileInput.addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  els.pgnInput.value = await file.text();
});
document.querySelectorAll("[data-sample]").forEach((btn) => {
  btn.addEventListener("click", () => loadSample(btn.getAttribute("data-sample")));
});
els.newGame.addEventListener("click", resetToImport);
els.flip.addEventListener("click", () => board.flip());
els.start.addEventListener("click", () => goTo(0));
els.prev.addEventListener("click", () => goTo(state.ply - 1));
els.next.addEventListener("click", () => goTo(state.ply + 1));
els.end.addEventListener("click", () => goTo(state.moves.length));
els.play.addEventListener("click", togglePlay);
els.playSpeed.addEventListener("change", () => {
  state.playSpeed = Number(els.playSpeed.value) || 1000;
});
els.moveList.addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-ply]");
  if (btn) goTo(Number(btn.getAttribute("data-ply")));
});

document.addEventListener("keydown", (ev) => {
  if (els.reviewPanel.hidden) return;
  const tag = ev.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (ev.key === " " || ev.code === "Space") {
    ev.preventDefault();
    togglePlay();
  } else if (ev.key === "ArrowLeft") {
    ev.preventDefault();
    goTo(state.ply - 1);
  } else if (ev.key === "ArrowRight") {
    ev.preventDefault();
    goTo(state.ply + 1);
  } else if (ev.key === "Home") {
    ev.preventDefault();
    goTo(0);
  } else if (ev.key === "End") {
    ev.preventDefault();
    goTo(state.moves.length);
  }
});

const params = new URLSearchParams(location.search);
if (params.get("depth") && els.depth.querySelector(`option[value="${params.get("depth")}"]`)) {
  els.depth.value = params.get("depth");
}

exposeDebug();
