/**
 * Stockfish 19 lite (single-threaded) running in a Web Worker.
 * The lite-single build does not need SharedArrayBuffer / COOP-COEP, so it
 * works on GitHub Pages and other static hosts.
 */

const ENGINE_URL = new URL(
  "../vendor/stockfish/stockfish-19-lite-single.js",
  import.meta.url
).href;

function parseScore(tokens, i) {
  // tokens[i] is "score", followed by "cp" / "mate" and a number.
  const kind = tokens[i + 1];
  const value = Number(tokens[i + 2]);
  if (kind === "mate") return { mate: value };
  return { cp: value };
}

function parseInfo(line) {
  if (!line.startsWith("info ") || !/\bscore\b/.test(line) || !/\bpv\b/.test(line)) {
    return null;
  }
  const tokens = line.trim().split(/\s+/);
  const out = { depth: 0, multipv: 1, score: { cp: 0 }, pv: [] };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "depth") out.depth = Number(tokens[++i]);
    else if (t === "seldepth") out.seldepth = Number(tokens[++i]);
    else if (t === "multipv") out.multipv = Number(tokens[++i]);
    else if (t === "score") {
      out.score = parseScore(tokens, i);
      i += 2;
    } else if (t === "nodes") out.nodes = Number(tokens[++i]);
    else if (t === "nps") out.nps = Number(tokens[++i]);
    else if (t === "pv") {
      out.pv = tokens.slice(i + 1);
      break;
    }
  }
  return out;
}

export class StockfishEngine {
  constructor() {
    this.worker = null;
    this.ready = false;
    this._waiters = [];
    this._infoHandler = null;
    this._queue = Promise.resolve();
  }

  async init() {
    if (this.ready) return;
    this.worker = new Worker(ENGINE_URL);
    this.worker.onmessage = (ev) => {
      const line = typeof ev.data === "string" ? ev.data : "";
      if (this._infoHandler && line.startsWith("info ")) this._infoHandler(line);
      if (this._waiters.length) {
        const { prefix, resolve } = this._waiters[0];
        if (line === prefix || line.startsWith(prefix)) {
          this._waiters.shift();
          resolve(line);
        }
      }
    };
    this.worker.onerror = (err) => {
      console.error("Stockfish worker error", err);
    };
    this._send("uci");
    await this._wait("uciok");
    this._send("setoption name Hash value 64");
    this._send("setoption name MultiPV value 3");
    this._send("isready");
    await this._wait("readyok");
    this.ready = true;
  }

  _send(cmd) {
    this.worker.postMessage(cmd);
  }

  _wait(prefix) {
    return new Promise((resolve) => {
      this._waiters.push({ prefix, resolve });
    });
  }

  /**
   * Analyze a position. Resolves with
   * { bestMove, ponder, lines: [{ depth, multipv, score, pv }] }
   * Scores are from the side to move.
   */
  analyze(fen, { depth = 18, multiPv = 3, onInfo } = {}) {
    const run = async () => {
      if (!this.ready) await this.init();
      this._send("stop");
      this._send("isready");
      await this._wait("readyok");
      this._send(`setoption name MultiPV value ${multiPv}`);
      this._send(`position fen ${fen}`);
      const lines = new Map();
      this._infoHandler = (line) => {
        const parsed = parseInfo(line);
        if (!parsed || !parsed.pv.length) return;
        lines.set(parsed.multipv, parsed);
        if (onInfo) onInfo(parsed, lines);
      };
      this._send(`go depth ${depth}`);
      const bestLine = await this._wait("bestmove ");
      this._infoHandler = null;
      const parts = bestLine.trim().split(/\s+/);
      const bestMove = parts[1] === "(none)" ? null : parts[1];
      const ponder = parts[3] && parts[3] !== "(none)" ? parts[3] : null;
      const ranked = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
      return { bestMove, ponder, lines: ranked, rawBest: bestLine };
    };
    const next = this._queue.then(run, run);
    this._queue = next.then(
      () => {},
      () => {}
    );
    return next;
  }

  stop() {
    if (this.worker) this._send("stop");
  }

  terminate() {
    if (this.worker) {
      this._send("quit");
      this.worker.terminate();
    }
    this.worker = null;
    this.ready = false;
    this._waiters = [];
  }
}

export function uciToFromTo(uci) {
  if (!uci || uci.length < 4) return null;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || null };
}
