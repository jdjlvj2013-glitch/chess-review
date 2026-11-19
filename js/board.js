/**
 * Interactive chessboard with official CBurnett piece SVGs and
 * eased slide animations for stepping through a game.
 */

const FILES = "abcdefgh";
const PIECE_SRC = {
  wK: "vendor/cburnett/wK.svg",
  wQ: "vendor/cburnett/wQ.svg",
  wR: "vendor/cburnett/wR.svg",
  wB: "vendor/cburnett/wB.svg",
  wN: "vendor/cburnett/wN.svg",
  wP: "vendor/cburnett/wP.svg",
  bK: "vendor/cburnett/bK.svg",
  bQ: "vendor/cburnett/bQ.svg",
  bR: "vendor/cburnett/bR.svg",
  bB: "vendor/cburnett/bB.svg",
  bN: "vendor/cburnett/bN.svg",
  bP: "vendor/cburnett/bP.svg",
};

const DEFAULT_MOVE_MS = 260;
const FADE_MS = 160;

function fileRank(square) {
  return { file: FILES.indexOf(square[0]), rank: Number(square[1]) - 1 };
}

function parseFenPieces(fen) {
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
      pieces.push({ square: FILES[f] + (r + 1), type: ch.toLowerCase(), color });
      f += 1;
    }
  }
  return pieces;
}

function isCastle(move) {
  const flags = move.flags || "";
  return flags.includes("k") || flags.includes("q") || move.san === "O-O" || move.san === "O-O-O";
}

function isKingSide(move) {
  const flags = move.flags || "";
  return flags.includes("k") || move.san === "O-O";
}

function rookCastle(move) {
  if (!isCastle(move)) return null;
  const kingSide = isKingSide(move);
  if (move.color === "w") {
    return kingSide ? { from: "h1", to: "f1" } : { from: "a1", to: "d1" };
  }
  return kingSide ? { from: "h8", to: "f8" } : { from: "a8", to: "d8" };
}

function captureSquare(move) {
  if (!move) return null;
  const flags = move.flags || "";
  if (flags.includes("e") || move.enPassant) {
    return move.to[0] + move.from[1];
  }
  if (move.captured) return move.to;
  return move.capturedSquare || null;
}

function pieceKey(color, type) {
  return color + type.toUpperCase();
}

export class BoardView {
  constructor(container, { onSquare = null } = {}) {
    this.container = container;
    this.onSquare = onSquare;
    this.orientation = "w";
    this.fen = "8/8/8/8/8/8/8/8 w - - 0 1";
    this.lastMove = null;
    this.bestArrow = null;
    this.badge = null;
    this.pieces = new Map(); // square -> HTMLElement
    this._token = 0;
    this._badgeTimer = 0;
    this._build();
  }

  _build() {
    this.container.innerHTML = "";
    this.container.classList.add("board-wrap");

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    bg.setAttribute("viewBox", "0 0 8 8");
    bg.setAttribute("class", "chess-board board-bg");
    bg.setAttribute("role", "img");
    bg.setAttribute("aria-label", "Chess board");
    bg.innerHTML = `
      <defs>
        <marker id="arrow-head" markerWidth="3.2" markerHeight="3.2" refX="1.8" refY="1.6" orient="auto">
          <path d="M0 .2 L2 1.6 L0 3 z" fill="currentColor"></path>
        </marker>
      </defs>
      <g class="squares"></g>
      <g class="coords"></g>
      <g class="highlights"></g>
      <g class="arrows"></g>
    `;
    this.svg = bg;

    this.pieceLayer = document.createElement("div");
    this.pieceLayer.className = "piece-layer";

    const fg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    fg.setAttribute("viewBox", "0 0 8 8");
    fg.setAttribute("class", "chess-board board-fg");
    fg.setAttribute("aria-hidden", "true");
    fg.innerHTML = `<g class="badges"></g>`;
    this.overlay = fg;

    this.container.appendChild(bg);
    this.container.appendChild(this.pieceLayer);
    this.container.appendChild(fg);

    this._drawSquares();
    this._drawCoords();
    bg.addEventListener("click", (ev) => {
      const sq = ev.target.closest("[data-square]");
      if (sq && this.onSquare) this.onSquare(sq.getAttribute("data-square"));
    });
  }

  _xy(square) {
    const { file, rank } = fileRank(square);
    if (this.orientation === "w") return { x: file, y: 7 - rank };
    return { x: 7 - file, y: rank };
  }

  _transform(square) {
    const { x, y } = this._xy(square);
    return `translate(${x * 100}%, ${y * 100}%)`;
  }

  _drawSquares() {
    const g = this.svg.querySelector(".squares");
    g.innerHTML = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const file = this.orientation === "w" ? x : 7 - x;
        const rank = this.orientation === "w" ? 7 - y : y;
        const square = FILES[file] + (rank + 1);
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(x));
        rect.setAttribute("y", String(y));
        rect.setAttribute("width", "1");
        rect.setAttribute("height", "1");
        rect.setAttribute("data-square", square);
        rect.setAttribute("class", (file + rank) % 2 === 0 ? "sq dark" : "sq light");
        g.appendChild(rect);
      }
    }
  }

  _drawCoords() {
    const g = this.svg.querySelector(".coords");
    g.innerHTML = "";
    for (let i = 0; i < 8; i++) {
      const file = this.orientation === "w" ? i : 7 - i;
      const rank = this.orientation === "w" ? 8 - i : i + 1;
      const fileOnDark = file % 2 === 1;
      const rankOnDark = (this.orientation === "w" ? 7 - i : i) % 2 === 0;
      const ft = document.createElementNS("http://www.w3.org/2000/svg", "text");
      ft.setAttribute("x", String(i + 0.93));
      ft.setAttribute("y", "7.92");
      ft.setAttribute("class", fileOnDark ? "coord on-dark" : "coord on-light");
      ft.setAttribute("text-anchor", "end");
      ft.textContent = FILES[file];
      g.appendChild(ft);
      const rt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      rt.setAttribute("x", "0.08");
      rt.setAttribute("y", String(i + 0.18));
      rt.setAttribute("class", rankOnDark ? "coord on-dark" : "coord on-light");
      rt.setAttribute("text-anchor", "start");
      rt.textContent = String(rank);
      g.appendChild(rt);
    }
  }

  setOrientation(color) {
    this.orientation = color === "b" ? "b" : "w";
    this._drawSquares();
    this._drawCoords();
    this._drawHighlights();
    this._drawArrow();
    this._drawBadge();
    this._relayoutPieces(false);
  }

  flip() {
    this.setOrientation(this.orientation === "w" ? "b" : "w");
  }

  setPosition(fen, transition = { type: "none" }) {
    this.update({ fen, transition });
  }

  setLastMove(from, to) {
    this.lastMove = from && to ? { from, to } : null;
    this._drawHighlights();
  }

  setBestArrow(from, to) {
    this.bestArrow = from && to ? { from, to } : null;
    this._drawArrow();
  }

  setBadge(square, classification, color, symbol) {
    this.badge = square ? { square, classification, color, symbol } : null;
    this._drawBadge();
  }

  /**
   * Apply a new position and decorations. `transition` is
   * { type: 'none'|'move'|'fade', move?, reverse?, duration? }.
   */
  update({ fen, lastMove, badge, bestArrow, transition = { type: "none" } } = {}) {
    if (fen) this.fen = fen;
    this.lastMove = lastMove && lastMove.from ? lastMove : null;
    this.bestArrow = bestArrow && bestArrow.from ? bestArrow : null;
    this._drawHighlights();

    const next = parseFenPieces(this.fen);
    const type = transition?.type || "none";
    const token = ++this._token;

    if (type === "move" && transition.move) {
      this._animateMove(next, transition.move, Boolean(transition.reverse), transition.duration || DEFAULT_MOVE_MS, token);
    } else if (type === "fade") {
      this._crossfade(next, transition.duration || FADE_MS, token);
    } else {
      this._syncPieces(next, false);
    }

    const delay =
      type === "move" ? Math.max(80, (transition.duration || DEFAULT_MOVE_MS) * 0.65) : type === "fade" ? (transition.duration || FADE_MS) : 0;
    this._queueBadge(badge || null, delay, token);

    if (type === "move" || type === "fade") {
      window.setTimeout(() => {
        if (token !== this._token) return;
        this._drawArrow();
      }, delay);
    } else {
      this._drawArrow();
    }
  }

  _queueBadge(badge, delay, token) {
    if (this._badgeTimer) window.clearTimeout(this._badgeTimer);
    if (!delay) {
      this.badge = badge;
      this._drawBadge();
      return;
    }
    this.badge = null;
    this._drawBadge();
    this._badgeTimer = window.setTimeout(() => {
      if (token !== this._token) return;
      this.badge = badge;
      this._drawBadge();
    }, delay);
  }

  _createPiece(color, type, square, anim) {
    const el = document.createElement("div");
    el.className = "piece" + (anim ? "" : " no-anim");
    el.dataset.color = color;
    el.dataset.type = type;
    el.dataset.square = square;
    el.dataset.piece = pieceKey(color, type);
    const img = document.createElement("img");
    img.src = PIECE_SRC[pieceKey(color, type)];
    img.alt = `${color === "w" ? "White" : "Black"} ${type}`;
    img.draggable = false;
    el.appendChild(img);
    el.style.transform = this._transform(square);
    this.pieceLayer.appendChild(el);
    if (!anim) {
      // Force a reflow so later transitions are not batched with this placement.
      void el.offsetWidth;
      el.classList.remove("no-anim");
    }
    return el;
  }

  _setGraphic(el, color, type) {
    const key = pieceKey(color, type);
    if (el.dataset.piece === key) return;
    el.dataset.color = color;
    el.dataset.type = type;
    el.dataset.piece = key;
    const img = el.querySelector("img");
    if (img) {
      img.src = PIECE_SRC[key];
      img.alt = `${color === "w" ? "White" : "Black"} ${type}`;
    }
  }

  _place(el, square, anim) {
    if (!anim) el.classList.add("no-anim");
    el.dataset.square = square;
    el.style.transform = this._transform(square);
    el.style.opacity = "1";
    el.classList.remove("capturing");
    if (!anim) {
      void el.offsetWidth;
      el.classList.remove("no-anim");
    }
  }

  _syncPieces(list, anim) {
    const taken = new Set();
    const nextMap = new Map();
    for (const p of list) {
      let el = this.pieces.get(p.square);
      if (el && el.dataset.color === p.color && el.dataset.type === p.type && !taken.has(el)) {
        taken.add(el);
        this._place(el, p.square, anim);
        nextMap.set(p.square, el);
        continue;
      }
      el = null;
      for (const cand of this.pieces.values()) {
        if (taken.has(cand)) continue;
        if (cand.dataset.color === p.color && cand.dataset.type === p.type) {
          el = cand;
          break;
        }
      }
      if (el) {
        taken.add(el);
        this._place(el, p.square, anim);
        nextMap.set(p.square, el);
      } else {
        const created = this._createPiece(p.color, p.type, p.square, anim);
        nextMap.set(p.square, created);
        taken.add(created);
      }
    }
    for (const el of this.pieces.values()) {
      if (!taken.has(el)) el.remove();
    }
    this.pieces = nextMap;
  }

  _relayoutPieces(anim) {
    for (const [square, el] of this.pieces) {
      this._place(el, square, anim);
    }
  }

  _crossfade(list, duration, token) {
    this.pieceLayer.classList.add("fading");
    window.setTimeout(() => {
      if (token !== this._token) return;
      this._syncPieces(list, false);
      this.pieceLayer.classList.remove("fading");
    }, duration);
  }

  _animateMove(nextList, move, reverse, duration, token) {
    const from = reverse ? move.to : move.from;
    const to = reverse ? move.from : move.to;
    let mover = this.pieces.get(from);
    if (!mover) {
      this._syncPieces(nextList, false);
      return;
    }

    // Promotion: going forward, keep the pawn until it lands; going back, show a pawn first.
    if (move.promotion) {
      if (reverse) this._setGraphic(mover, move.color, move.piece || "p");
    }

    const capSq = captureSquare(move);
    if (!reverse && capSq) {
      const cap = this.pieces.get(capSq);
      if (cap && cap !== mover) {
        cap.classList.add("capturing");
      }
    }
    if (reverse && capSq) {
      const capType = move.captured || "p";
      const capColor = move.color === "w" ? "b" : "w";
      let cap = this._createPiece(capColor, capType, capSq, false);
      cap.style.opacity = "0";
      void cap.offsetWidth;
      cap.style.opacity = "1";
      this.pieces.set(capSq, cap);
    }

    this.pieces.delete(from);
    this.pieces.set(to, mover);
    this._place(mover, to, true);
    mover.style.zIndex = "5";

    const rook = rookCastle(move);
    if (rook) {
      const rFrom = reverse ? rook.to : rook.from;
      const rTo = reverse ? rook.from : rook.to;
      const rookEl = this.pieces.get(rFrom);
      if (rookEl) {
        this.pieces.delete(rFrom);
        this.pieces.set(rTo, rookEl);
        this._place(rookEl, rTo, true);
        rookEl.style.zIndex = "4";
      }
    }

    window.setTimeout(() => {
      if (token !== this._token) return;
      if (move.promotion && !reverse) this._setGraphic(mover, move.color, move.promotion);
      mover.style.zIndex = "";
      this._syncPieces(nextList, false);
    }, duration + 20);
  }

  _drawHighlights() {
    const g = this.svg.querySelector(".highlights");
    g.innerHTML = "";
    if (!this.lastMove) return;
    for (const sq of [this.lastMove.from, this.lastMove.to]) {
      const { x, y } = this._xy(sq);
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", "1");
      rect.setAttribute("height", "1");
      rect.setAttribute("class", "last-move");
      rect.setAttribute("pointer-events", "none");
      g.appendChild(rect);
    }
  }

  _drawArrow() {
    const g = this.svg.querySelector(".arrows");
    g.innerHTML = "";
    if (!this.bestArrow) return;
    const a = this._xy(this.bestArrow.from);
    const b = this._xy(this.bestArrow.to);
    const x1 = a.x + 0.5;
    const y1 = a.y + 0.5;
    const x2 = b.x + 0.5;
    const y2 = b.y + 0.5;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const shrink = 0.28;
    const nx = dx / len;
    const ny = dy / len;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(x1 + nx * 0.22));
    line.setAttribute("y1", String(y1 + ny * 0.22));
    line.setAttribute("x2", String(x2 - nx * shrink));
    line.setAttribute("y2", String(y2 - ny * shrink));
    line.setAttribute("class", "best-arrow");
    line.setAttribute("marker-end", "url(#arrow-head)");
    line.setAttribute("pointer-events", "none");
    g.appendChild(line);
  }

  _drawBadge() {
    const g = this.overlay.querySelector(".badges");
    g.innerHTML = "";
    if (!this.badge) return;
    const { x, y } = this._xy(this.badge.square);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("pointer-events", "none");
    group.setAttribute("class", "board-badge");
    group.setAttribute("data-badge", this.badge.classification || "");
    const cx = x + 0.82;
    const cy = y + 0.18;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(cx));
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", "0.16");
    circle.setAttribute("fill", this.badge.color || "#5cbf6a");
    circle.setAttribute("stroke", "rgba(0,0,0,0.35)");
    circle.setAttribute("stroke-width", "0.02");
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(cx));
    text.setAttribute("y", String(cy + 0.015));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("class", "badge-text");
    const symbol = this.badge.symbol || "";
    const emoji = /[👍📖]/.test(symbol);
    text.setAttribute("font-size", emoji ? "0.18" : symbol.length > 1 ? "0.14" : "0.18");
    text.setAttribute("font-weight", "700");
    text.setAttribute("fill", "#fff");
    text.textContent = symbol;
    group.appendChild(circle);
    group.appendChild(text);
    g.appendChild(group);
  }
}

export { DEFAULT_MOVE_MS };
