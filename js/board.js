/**
 * Interactive SVG chessboard with CBurnett-style pieces (public domain).
 */

const FILES = "abcdefgh";

// Public-domain CBurnett piece paths, viewBox 0 0 45 45.
const PIECE_SVG = {
  wK: `<g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="miter"><path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#fff" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7"/><path d="M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0" fill="none"/></g>`,
  wQ: `<g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm15.5-3a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM39 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-9 21.5-9 30 0l-4 13s-5.5 5.5-11 5.5-11-5.5-11-5.5L9 26z" stroke-linecap="butt"/><path d="M9 26c0 0 4.5 7 10.5 7A13.23 13.23 0 0 0 25 24.9 13.23 13.23 0 0 0 30.5 33C36.5 33 41 26 41 26" fill="none"/><path d="M11.5 30c3.5-1.5 18-1 24 0M10.5 33.5c6-1 21.5-1 27 0M11.5 37c8-1 16.5-1 23 0" fill="none"/></g>`,
  wR: `<g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zm3-4h21v-4H12v4zm-1-22V9h4v2h5V9h5v2h5V9h4v4"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M31 29.5 32.5 32H12.5L14 29.5"/><path d="M11 14h23" fill="none"/></g>`,
  wB: `<g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#fff" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 1.5 2-.19 1.94-1.5 3-1.5 3H9s-1.31-1.06-1.5-3c-.15-1.46 1.5-2 1.5-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" fill="none" stroke-linejoin="miter"/></g>`,
  wN: `<g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-1-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-2 2.5-3c1 0 1 3 1 3"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.43-9.75a.5 1.5 30 1 1-.87-.5.5 1.5 30 1 1 .87.5z" fill="#000" stroke="none"/></g>`,
  wP: `<path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>`,
  bK: `<g fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="miter"><path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#000" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7"/><path d="M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0" fill="none" stroke="#fff"/></g>`,
  bQ: `<g fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#000"><circle cx="6" cy="12" r="2"/><circle cx="13.5" cy="8.5" r="2"/><circle cx="22.5" cy="8" r="2"/><circle cx="31.5" cy="8.5" r="2"/><circle cx="39" cy="12" r="2"/></g><path d="M9 26c8.5-9 21.5-9 30 0l-4 13s-5.5 5.5-11 5.5-11-5.5-11-5.5L9 26z" stroke-linecap="butt"/><path d="M9 26c0 0 4.5 7 10.5 7A13.23 13.23 0 0 0 25 24.9 13.23 13.23 0 0 0 30.5 33C36.5 33 41 26 41 26" fill="none" stroke="#fff"/><path d="M11.5 30c3.5-1.5 18-1 24 0M10.5 33.5c6-1 21.5-1 27 0M11.5 37c8-1 16.5-1 23 0" fill="none" stroke="#fff"/></g>`,
  bR: `<g fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zm3.5-7 1.5-2.5h17l1.5 2.5h-20zM12 31v-4h21v4H12z" stroke-linecap="butt"/><path d="M14 27v-10h17v10H14z" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M14 16.5 11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z"/><path d="M12 35.5h21m-20-20.5h19m-18 6.5h17m-17 10.5h17M11 14h23" fill="none" stroke="#fff" stroke-width="1" stroke-linejoin="miter"/></g>`,
  bB: `<g fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#000" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 1.5 2-.19 1.94-1.5 3-1.5 3H9s-1.31-1.06-1.5-3c-.15-1.46 1.5-2 1.5-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/></g><path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" fill="none" stroke="#fff" stroke-linejoin="miter"/></g>`,
  bN: `<g fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-1-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-2 2.5-3c1 0 1 3 1 3"/><path d="M24.55 10.4l-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34-2.37-4.49-5.79-6.64-9.19-7.16l-.51-.1z" fill="#fff" stroke="none"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.43-9.75a.5 1.5 30 1 1-.87-.5.5 1.5 30 1 1 .87.5z" fill="#fff" stroke="#fff"/><path d="M24.55 10.4l-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34-2.37-4.49-5.79-6.64-9.19-7.16l-.51-.1z" fill="none" stroke="#fff" stroke-width="1"/></g>`,
  bP: `<path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>`,
};

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

export class BoardView {
  constructor(container, { onSquare = null } = {}) {
    this.container = container;
    this.onSquare = onSquare;
    this.orientation = "w";
    this.fen = "8/8/8/8/8/8/8/8 w - - 0 1";
    this.lastMove = null;
    this.bestArrow = null;
    this.badge = null;
    this._build();
  }

  _build() {
    this.container.innerHTML = "";
    this.container.classList.add("board-wrap");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 8 8");
    svg.setAttribute("class", "chess-board");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Chess board");
    svg.innerHTML = `
      <defs>
        <marker id="arrow-head" markerWidth="3.2" markerHeight="3.2" refX="1.8" refY="1.6" orient="auto">
          <path d="M0 .2 L2 1.6 L0 3 z" fill="currentColor"></path>
        </marker>
        <filter id="piece-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0.04" dy="0.06" stdDeviation="0.04" flood-opacity="0.28"/>
        </filter>
      </defs>
      <g class="squares"></g>
      <g class="coords"></g>
      <g class="highlights"></g>
      <g class="pieces"></g>
      <g class="arrows"></g>
      <g class="badges"></g>
    `;
    this.svg = svg;
    this.container.appendChild(svg);
    this._drawSquares();
    this._drawCoords();
    svg.addEventListener("click", (ev) => {
      const sq = ev.target.closest("[data-square]");
      if (sq && this.onSquare) this.onSquare(sq.getAttribute("data-square"));
    });
  }

  _xy(square) {
    const { file, rank } = fileRank(square);
    if (this.orientation === "w") return { x: file, y: 7 - rank };
    return { x: 7 - file, y: rank };
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
      const fileOnDark = (file % 2 === 1);
      const rankOnDark = ((this.orientation === "w" ? 7 - i : i) % 2 === 0);
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
    this.render();
  }

  flip() {
    this.setOrientation(this.orientation === "w" ? "b" : "w");
  }

  setPosition(fen) {
    this.fen = fen;
    this.render();
  }

  setLastMove(from, to) {
    this.lastMove = from && to ? { from, to } : null;
    this.render();
  }

  setBestArrow(from, to) {
    this.bestArrow = from && to ? { from, to } : null;
    this.render();
  }

  setBadge(square, classification, color, symbol) {
    this.badge = square ? { square, classification, color, symbol } : null;
    this.render();
  }

  render() {
    this._drawHighlights();
    this._drawPieces();
    this._drawArrow();
    this._drawBadge();
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

  _drawPieces() {
    const g = this.svg.querySelector(".pieces");
    g.innerHTML = "";
    for (const p of parseFenPieces(this.fen)) {
      const { x, y } = this._xy(p.square);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("x", String(x));
      svg.setAttribute("y", String(y));
      svg.setAttribute("width", "1");
      svg.setAttribute("height", "1");
      svg.setAttribute("viewBox", "0 0 45 45");
      svg.setAttribute("class", "piece");
      svg.setAttribute("data-square", p.square);
      svg.setAttribute("pointer-events", "none");
      svg.style.filter = "url(#piece-shadow)";
      svg.innerHTML = PIECE_SVG[p.color + p.type.toUpperCase()] || "";
      g.appendChild(svg);
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
    const g = this.svg.querySelector(".badges");
    g.innerHTML = "";
    if (!this.badge) return;
    const { x, y } = this._xy(this.badge.square);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("pointer-events", "none");
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
    // Emoji badges are slightly smaller so they fit the circle.
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
