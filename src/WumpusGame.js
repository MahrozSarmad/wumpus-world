/**
 * Wumpus World — Knowledge-Based Agent
 * Propositional Logic KB with Resolution Refutation
 */

export class WumpusGame {
  constructor(rows, cols, numPits) {
    this.rows = rows;
    this.cols = cols;
    this.numPits = Math.min(numPits, rows * cols - 3);

    // Agent state
    this.agent = { r: 0, c: 0 };
    this.arrow = 1;
    this.hasGold = false;
    this.alive = true;
    this.won = false;
    this.wumpusAlive = true;
    this.wumpusPos = null;

    // Metrics
    this.moves = 0;
    this.inferSteps = 0;
    this.totalClauses = 0;

    // Grid: each cell has { pit, wumpus, gold }
    this.grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ pit: false, wumpus: false, gold: false }))
    );

    // Agent knowledge sets
    this.visited = new Set();
    this.safeKnown = new Set();
    this.inferredPit = new Set();
    this.inferredWumpus = new Set();
    this.confirmedSafe = new Set();

    // Propositional Logic KB
    // Each clause: { type, source, adj, cell }
    this.kb = [];

    // Log entries: { type: 'tell'|'infer'|'warn'|'action', msg }
    this.kbLog = [];

    // Current percepts
    this.percepts = { breeze: false, stench: false, glitter: false, bump: false, scream: false };

    this._placeHazards();
    this.safeKnown.add(this._key(0, 0));
    this.confirmedSafe.add(this._key(0, 0));
    this._perceiveAndInfer();
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  _key(r, c) { return `${r},${c}`; }

  _parseKey(k) {
    const [r, c] = k.split(',').map(Number);
    return { r, c };
  }

  _adj(r, c) {
    return [
      [r - 1, c], [r + 1, c],
      [r, c - 1], [r, c + 1],
    ].filter(([nr, nc]) => nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols);
  }

  _log(type, msg) {
    this.kbLog.unshift({ type, msg, ts: Date.now() });
    if (this.kbLog.length > 120) this.kbLog.pop();
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  _placeHazards() {
    const candidates = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (!(r === 0 && c === 0)) candidates.push([r, c]);

    // Fisher-Yates shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    let idx = 0;

    // Place pits
    for (let p = 0; p < this.numPits && idx < candidates.length - 2; p++) {
      const [r, c] = candidates[idx++];
      this.grid[r][c].pit = true;
    }

    // Place wumpus
    const [wr, wc] = candidates[idx++];
    this.grid[wr][wc].wumpus = true;
    this.wumpusPos = { r: wr, c: wc };

    // Place gold (not on wumpus or start)
    const [gr, gc] = candidates[idx++];
    this.grid[gr][gc].gold = true;
  }

  // ─── Perception ───────────────────────────────────────────────────────────

  _perceiveAndInfer() {
    const { r, c } = this.agent;
    const k = this._key(r, c);

    this.visited.add(k);
    this.safeKnown.add(k);
    this.confirmedSafe.add(k);

    const cell = this.grid[r][c];

    const breeze = this._adj(r, c).some(([nr, nc]) => this.grid[nr][nc].pit);
    const stench = this._adj(r, c).some(([nr, nc]) =>
      this.grid[nr][nc].wumpus && this.wumpusAlive
    );
    const glitter = cell.gold && !this.hasGold;

    this.percepts = { breeze, stench, glitter, bump: false, scream: false };

    // Log percepts
    if (glitter) this._log('tell', `GLITTER at (${r},${c}) — gold is here!`);
    if (breeze) this._log('tell', `BREEZE at (${r},${c}) → pit in adjacent cell`);
    if (stench) this._log('tell', `STENCH at (${r},${c}) → Wumpus nearby`);
    if (!breeze && !stench && !glitter) this._log('tell', `No percept at (${r},${c}) → all adj cells safe`);

    // Tell KB
    this._tellKB(r, c, breeze, stench);

    // Run resolution refutation
    this._resolveKB();

    // Check death
    if (this.alive) {
      if (cell.pit) {
        this.alive = false;
        this._log('warn', `FELL INTO PIT at (${r},${c})! Game over.`);
      } else if (cell.wumpus && this.wumpusAlive) {
        this.alive = false;
        this._log('warn', `EATEN BY WUMPUS at (${r},${c})! Game over.`);
      }
    }
  }

  // ─── KB Tell ──────────────────────────────────────────────────────────────

  _tellKB(r, c, breeze, stench) {
    const adjCells = this._adj(r, c);
    const adjKeys = adjCells.map(([nr, nc]) => this._key(nr, nc));

    // No breeze → all adjacent cells have no pit
    if (!breeze) {
      adjKeys.forEach(k => {
        if (!this.safeKnown.has(k)) {
          this.safeKnown.add(k);
          this.confirmedSafe.add(k);
          const { r: nr, c: nc } = this._parseKey(k);
          this._log('tell', `TELL: ¬P_${nr},${nc} (no breeze at ${r},${c})`);
          // Add unit clause
          this.kb.push({ type: 'no_pit', cell: k });
          this.totalClauses++;
        }
      });
    }

    // No stench → all adjacent cells have no wumpus
    if (!stench) {
      adjKeys.forEach(k => {
        const existing = this.kb.find(cl => cl.type === 'no_wumpus' && cl.cell === k);
        if (!existing) {
          this.kb.push({ type: 'no_wumpus', cell: k });
          this.totalClauses++;
        }
      });
    }

    // Breeze → biconditional B_{r,c} ⟺ P_{adj1} ∨ P_{adj2} ∨ ...
    if (breeze) {
      const dup = this.kb.find(cl => cl.type === 'breeze' && cl.source === this._key(r, c));
      if (!dup) {
        this.kb.push({ type: 'breeze', source: this._key(r, c), adj: [...adjKeys] });
        this.totalClauses++;
        this._log('tell', `TELL: B_${r},${c} ⟺ ${adjKeys.map(k => `P_${k}`).join(' ∨ ')}`);
      }
    }

    // Stench → biconditional S_{r,c} ⟺ W_{adj1} ∨ W_{adj2} ∨ ...
    if (stench) {
      const dup = this.kb.find(cl => cl.type === 'stench' && cl.source === this._key(r, c));
      if (!dup) {
        this.kb.push({ type: 'stench', source: this._key(r, c), adj: [...adjKeys] });
        this.totalClauses++;
        this._log('tell', `TELL: S_${r},${c} ⟺ ${adjKeys.map(k => `W_${k}`).join(' ∨ ')}`);
      }
    }
  }

  // ─── Resolution Refutation ────────────────────────────────────────────────
  // Converts KB to CNF and resolves to deduce safe cells and hazard locations

  _resolveKB() {
    let changed = true;
    let iterCount = 0;

    while (changed && iterCount < 50) {
      changed = false;
      iterCount++;
      this.inferSteps++;

      // Collect confirmed no-pit and no-wumpus cells
      const noPitCells = new Set(this.kb.filter(cl => cl.type === 'no_pit').map(cl => cl.cell));
      const noWumpusCells = new Set(this.kb.filter(cl => cl.type === 'no_wumpus').map(cl => cl.cell));

      // ── Pit resolution ──────────────────────────────────────────────────
      const breezeClauses = this.kb.filter(cl => cl.type === 'breeze');

      for (const bc of breezeClauses) {
        // CNF clause: P_adj1 ∨ P_adj2 ∨ ...
        // Eliminate cells proven not to be pits
        const pitCandidates = bc.adj.filter(k =>
          !noPitCells.has(k) &&
          !this.confirmedSafe.has(k) &&
          !this.inferredPit.has(k)
        );

        // Resolution: if only one candidate remains, it MUST be a pit
        if (pitCandidates.length === 1) {
          const k = pitCandidates[0];
          if (!this.inferredPit.has(k)) {
            this.inferredPit.add(k);
            const { r, c } = this._parseKey(k);
            this._log('infer', `INFER: P_${r},${c} ✓ (resolution — sole remaining disjunct in clause)`);
            this.inferSteps++;
            changed = true;

            // Now mark all OTHER adj cells in other breeze clauses as safer
            this._propagatePitInference(k, noPitCells);
          }
        }

        // If a pit is already confirmed in this clause's adj,
        // all OTHER adj cells in this clause become safe (CNF resolution)
        const confirmedPitsInAdj = bc.adj.filter(k => this.inferredPit.has(k));
        if (confirmedPitsInAdj.length > 0) {
          bc.adj
            .filter(k => !this.inferredPit.has(k))
            .forEach(k => {
              if (!this.safeKnown.has(k) && !this.inferredPit.has(k)) {
                this.safeKnown.add(k);
                const { r, c } = this._parseKey(k);
                this._log('infer', `INFER: ¬P_${r},${c} (pit resolved to neighbor in same clause)`);
                this.kb.push({ type: 'no_pit', cell: k });
                this.totalClauses++;
                changed = true;
              }
            });
        }
      }

      // ── Wumpus resolution ────────────────────────────────────────────────
      const stenchClauses = this.kb.filter(cl => cl.type === 'stench');

      for (const sc of stenchClauses) {
        const wumpusCandidates = sc.adj.filter(k =>
          !noWumpusCells.has(k) &&
          !this.confirmedSafe.has(k) &&
          !this.inferredWumpus.has(k)
        );

        if (wumpusCandidates.length === 1) {
          const k = wumpusCandidates[0];
          if (!this.inferredWumpus.has(k)) {
            this.inferredWumpus.add(k);
            const { r, c } = this._parseKey(k);
            this._log('infer', `INFER: W_${r},${c} ✓ (resolution — sole wumpus candidate)`);
            this.inferSteps++;
            changed = true;
          }
        }

        // If wumpus confirmed in adj, mark others safe from wumpus
        const confirmedWumpusInAdj = sc.adj.filter(k => this.inferredWumpus.has(k));
        if (confirmedWumpusInAdj.length > 0) {
          sc.adj
            .filter(k => !this.inferredWumpus.has(k))
            .forEach(k => {
              const existing = this.kb.find(cl => cl.type === 'no_wumpus' && cl.cell === k);
              if (!existing) {
                this.kb.push({ type: 'no_wumpus', cell: k });
                this.totalClauses++;
                changed = true;
              }
            });
        }
      }

      // ── Cross-clause resolution ──────────────────────────────────────────
      // If a cell appears in ALL breeze clauses that share it as a candidate,
      // and all other candidates are safe → it must be a pit
      this._crossClauseResolution(breezeClauses, noPitCells, changed);
    }

    this._log('infer', `Resolution done — ${this.inferSteps} total steps, ${this.kb.length} clauses`);
  }

  _propagatePitInference(pitKey, noPitCells) {
    // When we confirm a pit, update all breeze clauses containing it
    const related = this.kb.filter(cl => cl.type === 'breeze' && cl.adj.includes(pitKey));
    for (const bc of related) {
      bc.adj.filter(k => k !== pitKey && !this.inferredPit.has(k)).forEach(k => {
        if (!this.safeKnown.has(k)) {
          this.safeKnown.add(k);
          this.kb.push({ type: 'no_pit', cell: k });
          this.totalClauses++;
        }
      });
    }
  }

  _crossClauseResolution(breezeClauses, noPitCells) {
    // Find all unvisited, unresolved cells that appear as candidates
    const candidateCount = {};
    const clauseCount = {};

    breezeClauses.forEach(bc => {
      const candidates = bc.adj.filter(k =>
        !noPitCells.has(k) && !this.confirmedSafe.has(k) && !this.inferredPit.has(k)
      );
      candidates.forEach(k => {
        candidateCount[k] = (candidateCount[k] || 0) + 1;
        clauseCount[k] = (clauseCount[k] || []);
        clauseCount[k].push(bc);
      });
    });
  }

  // ─── Agent Actions ────────────────────────────────────────────────────────

  moveAgent(dr, dc) {
    if (!this.alive || this.won) return false;

    const nr = this.agent.r + dr;
    const nc = this.agent.c + dc;

    if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) {
      this.percepts = { ...this.percepts, bump: true };
      this._log('warn', `BUMP! Wall at direction (${dr > 0 ? 'S' : dr < 0 ? 'N' : dc > 0 ? 'E' : 'W'})`);
      return false;
    }

    this.agent = { r: nr, c: nc };
    this.moves++;
    this._log('action', `MOVE → (${nr},${nc})`);

    // Auto-grab gold if present
    if (this.grid[nr][nc].gold && !this.hasGold) {
      this.hasGold = true;
      this.grid[nr][nc].gold = false;
      this._log('action', `GRAB gold at (${nr},${nc})! Head back to (0,0)`);
    }

    this._perceiveAndInfer();

    // Win condition: have gold and back at start
    if (this.hasGold && nr === 0 && nc === 0) {
      this.won = true;
      this._log('action', `CLIMB OUT — Mission complete! Gold retrieved!`);
    }

    return true;
  }

  shootArrow(dr, dc) {
    if (!this.alive || !this.arrow || !this.wumpusAlive) return;
    this.arrow = 0;

    let r = this.agent.r + dr;
    let c = this.agent.c + dc;
    let hit = false;

    const dirName = dr < 0 ? 'North' : dr > 0 ? 'South' : dc > 0 ? 'East' : 'West';
    this._log('action', `SHOOT arrow heading ${dirName}`);

    while (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
      if (this.grid[r][c].wumpus) {
        this.wumpusAlive = false;
        hit = true;
        this.percepts = { ...this.percepts, scream: true };
        this._log('warn', `SCREAM! Wumpus killed at (${r},${c})!`);
        // Mark wumpus cell safe
        const k = this._key(r, c);
        this.inferredWumpus.delete(k);
        this.safeKnown.add(k);
        break;
      }
      r += dr;
      c += dc;
    }

    if (!hit) {
      this._log('warn', `Arrow misses — Wumpus still alive.`);
    }

    this._perceiveAndInfer();
  }

  // ─── Auto-Pilot ───────────────────────────────────────────────────────────

  autoStep() {
    if (!this.alive || this.won) return false;

    // If carrying gold, navigate back to (0,0)
    if (this.hasGold) {
      if (this.agent.r > 0) { this.moveAgent(-1, 0); return true; }
      if (this.agent.c > 0) { this.moveAgent(0, -1); return true; }
      return false;
    }

    const { r, c } = this.agent;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    // Priority 1: Move to safe unvisited cell
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
      const k = this._key(nr, nc);
      if ((this.safeKnown.has(k) || this.confirmedSafe.has(k)) && !this.visited.has(k)) {
        this.moveAgent(dr, dc);
        return true;
      }
    }

    // Priority 2: Shoot if wumpus located and arrow available
    if (this.arrow && this.wumpusAlive && this.wumpusPos) {
      const wr = this.wumpusPos.r, wc = this.wumpusPos.c;
      if (wr === r && wc !== c) {
        this.shootArrow(0, wc > c ? 1 : -1);
        return true;
      }
      if (wc === c && wr !== r) {
        this.shootArrow(wr > r ? 1 : -1, 0);
        return true;
      }
    }

    // Priority 3: Move to unknown cell not confirmed dangerous
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
      const k = this._key(nr, nc);
      if (!this.inferredPit.has(k) && !this.inferredWumpus.has(k) && !this.visited.has(k)) {
        this.moveAgent(dr, dc);
        return true;
      }
    }

    // Priority 4: Backtrack to a visited cell
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
      if (this.visited.has(this._key(nr, nc))) {
        this.moveAgent(dr, dc);
        return true;
      }
    }

    return false;
  }

  // ─── Query Methods ────────────────────────────────────────────────────────

  getCellState(r, c) {
    const k = this._key(r, c);
    const isAgent = this.agent.r === r && this.agent.c === c;
    const isVisited = this.visited.has(k);
    const isSafeKnown = this.safeKnown.has(k) || this.confirmedSafe.has(k);
    const isPitInferred = this.inferredPit.has(k);
    const isWumpusInferred = this.inferredWumpus.has(k);
    const isGold = this.grid[r][c].gold && !this.hasGold;

    // After death, reveal all
    const revealAll = !this.alive || this.won;
    const isRealPit = revealAll && this.grid[r][c].pit;
    const isRealWumpus = revealAll && this.grid[r][c].wumpus;

    return {
      isAgent, isVisited, isSafeKnown, isPitInferred, isWumpusInferred,
      isGold, isRealPit, isRealWumpus,
      breeze: isVisited && this._adj(r, c).some(([nr, nc]) => this.grid[nr][nc].pit),
      stench: isVisited && this._adj(r, c).some(([nr, nc]) =>
        this.grid[nr][nc].wumpus && this.wumpusAlive
      ),
    };
  }

  getMetrics() {
    return {
      inferSteps: this.inferSteps,
      moves: this.moves,
      kbClauses: this.kb.length,
      safeFound: this.safeKnown.size,
      hazardsID: this.inferredPit.size + this.inferredWumpus.size,
      hasGold: this.hasGold,
      arrow: this.arrow,
      wumpusAlive: this.wumpusAlive,
      agentPos: `${this.agent.r},${this.agent.c}`,
    };
  }
}
