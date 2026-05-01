import { useState, useEffect, useRef, useCallback } from 'react'
import { WumpusGame } from './WumpusGame'
import styles from './App.module.css'

// ── Sub-components ──────────────────────────────────────────────────────────

function Cell({ r, c, game, onMove }) {
  const state = game.getCellState(r, c)
  const {
    isAgent, isVisited, isSafeKnown, isPitInferred, isWumpusInferred,
    isGold, isRealPit, isRealWumpus, breeze, stench,
  } = state

  const isDead = !game.alive && isAgent
  const isStart = r === 0 && c === 0

  let cellClass = styles.cell
  let icon = ''
  let subLabel = ''

  if (isDead) {
    cellClass += ' ' + styles.cellDead
    icon = '💀'
  } else if (isAgent) {
    cellClass += ' ' + styles.cellAgent
    icon = game.hasGold ? '🤠' : '🤖'
    if (breeze) subLabel += 'B'
    if (stench) subLabel += stench && subLabel ? '+S' : 'S'
  } else if (isRealPit) {
    cellClass += ' ' + styles.cellPit
    icon = '🕳'
  } else if (isRealWumpus && !game.wumpusAlive) {
    cellClass += ' ' + styles.cellWumpusDead
    icon = '💀'
    subLabel = 'Wumpus'
  } else if (isRealWumpus) {
    cellClass += ' ' + styles.cellWumpus
    icon = '👾'
  } else if (isPitInferred) {
    cellClass += ' ' + styles.cellPit
    icon = '🕳'
    subLabel = '~PIT'
  } else if (isWumpusInferred && !game.wumpusAlive) {
    cellClass += ' ' + styles.cellSafe
    icon = '✓'
  } else if (isWumpusInferred) {
    cellClass += ' ' + styles.cellWumpus
    icon = '👾'
    subLabel = '~WMP'
  } else if (isGold && isVisited) {
    cellClass += ' ' + styles.cellGold
    icon = '💎'
  } else if (isVisited) {
    cellClass += ' ' + styles.cellVisited
    icon = isStart ? '⭐' : '·'
    if (breeze) subLabel += 'B'
    if (stench) subLabel += stench && subLabel ? '+S' : 'S'
  } else if (isSafeKnown) {
    cellClass += ' ' + styles.cellSafe
    icon = '✓'
  } else {
    cellClass += ' ' + styles.cellUnknown
    icon = '?'
  }

  const handleClick = () => {
    if (!game.alive || game.won) return
    const dr = r - game.agent.r
    const dc = c - game.agent.c
    if (Math.abs(dr) + Math.abs(dc) === 1) onMove(dr, dc)
  }

  return (
    <div className={cellClass} onClick={handleClick} title={`Cell (${r},${c})`}>
      <span className={styles.cellCoord}>{r},{c}</span>
      <span className={styles.cellIcon}>{icon}</span>
      {subLabel && <span className={styles.cellSub}>{subLabel}</span>}
    </div>
  )
}

function MetricCard({ label, value, accent }) {
  return (
    <div className={styles.metricCard}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue} style={accent ? { color: accent } : {}}>
        {value}
      </span>
    </div>
  )
}

function Badge({ label, type }) {
  return <span className={`${styles.badge} ${styles['badge_' + type]}`}>{label}</span>
}

function KBLogEntry({ entry }) {
  return (
    <div className={`${styles.logEntry} ${styles['log_' + entry.type]}`}>
      <span className={styles.logType}>{entry.type.toUpperCase()}</span>
      <span className={styles.logMsg}>{entry.msg}</span>
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [rows, setRows] = useState(4)
  const [cols, setCols] = useState(4)
  const [numPits, setNumPits] = useState(3)
  const [game, setGame] = useState(null)
  const [tick, setTick] = useState(0)
  const [isAuto, setIsAuto] = useState(false)
  const [autoSpeed, setAutoSpeed] = useState(600)
  const autoRef = useRef(null)
  const gameRef = useRef(null)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  const newGame = useCallback(() => {
    if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null; setIsAuto(false) }
    const g = new WumpusGame(
      Math.min(8, Math.max(3, rows)),
      Math.min(8, Math.max(3, cols)),
      Math.min(10, Math.max(1, numPits))
    )
    gameRef.current = g
    setGame(g)
    refresh()
  }, [rows, cols, numPits, refresh])

  // Start a default game on mount
  useEffect(() => { newGame() }, []) // eslint-disable-line

  const doMove = useCallback((dr, dc) => {
    if (!gameRef.current) return
    gameRef.current.moveAgent(dr, dc)
    refresh()
  }, [refresh])

  const doShoot = useCallback((dr, dc) => {
    if (!gameRef.current) return
    gameRef.current.shootArrow(dr, dc)
    refresh()
  }, [refresh])

  const toggleAuto = useCallback(() => {
    if (autoRef.current) {
      clearInterval(autoRef.current)
      autoRef.current = null
      setIsAuto(false)
      return
    }
    setIsAuto(true)
    autoRef.current = setInterval(() => {
      const g = gameRef.current
      if (!g || !g.alive || g.won) {
        clearInterval(autoRef.current)
        autoRef.current = null
        setIsAuto(false)
        setTick(t => t + 1)
        return
      }
      const moved = g.autoStep()
      setTick(t => t + 1)
      if (!moved || !g.alive || g.won) {
        clearInterval(autoRef.current)
        autoRef.current = null
        setIsAuto(false)
      }
    }, autoSpeed)
  }, [autoSpeed])

  // Keyboard controls
  useEffect(() => {
    const handler = (e) => {
      if (!gameRef.current || !gameRef.current.alive || gameRef.current.won) return
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': e.preventDefault(); doMove(-1, 0); break
        case 'ArrowDown': case 's': case 'S': e.preventDefault(); doMove(1, 0); break
        case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); doMove(0, -1); break
        case 'ArrowRight': case 'd': case 'D': e.preventDefault(); doMove(0, 1); break
        default: break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [doMove])

  // Cleanup on unmount
  useEffect(() => () => { if (autoRef.current) clearInterval(autoRef.current) }, [])

  if (!game) return <div className={styles.loading}>Initializing…</div>

  const metrics = game.getMetrics()
  const percepts = game.percepts
  const alive = game.alive
  const won = game.won
  const canAct = alive && !won

  // Build grid rows (display bottom-up: row 0 at bottom)
  const gridRows = []
  for (let r = game.rows - 1; r >= 0; r--) {
    const cells = []
    for (let c = 0; c < game.cols; c++) {
      cells.push(
        <Cell key={`${r}-${c}`} r={r} c={c} game={game} onMove={doMove} />
      )
    }
    gridRows.push(<div key={r} className={styles.gridRow}>{cells}</div>)
  }

  let statusClass = styles.statusPlaying
  let statusText = `Exploring cave… Agent at (${metrics.agentPos})${metrics.hasGold ? ' — carrying gold, return to (0,0)!' : ''}`
  if (!alive) { statusClass = styles.statusDead; statusText = 'Agent died! Press New Game to try again.' }
  if (won) { statusClass = styles.statusWon; statusText = '🏆 Victory! Gold retrieved and escaped!' }

  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <span className={styles.titleAccent}>⬡</span> Wumpus World
          </h1>
          <span className={styles.subtitle}>Knowledge-Based Agent · Propositional Logic · Resolution Refutation</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.version}>KB-AGENT v1.0</span>
        </div>
      </header>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>Rows</label>
          <input
            type="number" min="3" max="8" value={rows}
            onChange={e => setRows(Number(e.target.value))}
            className={styles.numberInput}
          />
        </div>
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>Cols</label>
          <input
            type="number" min="3" max="8" value={cols}
            onChange={e => setCols(Number(e.target.value))}
            className={styles.numberInput}
          />
        </div>
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>Pits</label>
          <input
            type="number" min="1" max="10" value={numPits}
            onChange={e => setNumPits(Number(e.target.value))}
            className={styles.numberInput}
          />
        </div>
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>Speed</label>
          <select
            value={autoSpeed}
            onChange={e => setAutoSpeed(Number(e.target.value))}
            className={styles.numberInput}
          >
            <option value={1000}>Slow</option>
            <option value={600}>Normal</option>
            <option value={300}>Fast</option>
            <option value={100}>Turbo</option>
          </select>
        </div>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={newGame}>
          New Game
        </button>
        <button
          className={`${styles.btn} ${isAuto ? styles.btnActive : styles.btnSecondary}`}
          onClick={toggleAuto}
          disabled={!canAct}
        >
          {isAuto ? '⏸ Stop Auto' : '▶ Auto Play'}
        </button>
      </div>

      {/* Status bar */}
      <div className={`${styles.statusBar} ${statusClass}`}>{statusText}</div>

      {/* Main layout */}
      <div className={styles.main}>

        {/* Grid section */}
        <div className={styles.gridSection}>
          <div className={styles.legend}>
            <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#3b82f6' }} />Agent</span>
            <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#22c55e', opacity: 0.5 }} />Safe</span>
            <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#185FA5', opacity: 0.35 }} />Visited</span>
            <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#2C2C2A' }} />Unknown</span>
            <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#7f1d1d' }} />Pit</span>
            <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#5b21b6' }} />Wumpus</span>
            <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#d97706' }} />Gold</span>
          </div>
          <div className={styles.gridWrap}>
            <div className={styles.grid}>{gridRows}</div>
          </div>

          {/* Move controls */}
          <div className={styles.moveSection}>
            <p className={styles.moveHint}>Click adjacent cell · Arrow keys / WASD · Or use buttons</p>
            <div className={styles.dpadWrap}>
              <div className={styles.dpad}>
                <div />
                <button className={`${styles.btn} ${styles.dpadBtn}`} onClick={() => doMove(-1, 0)} disabled={!canAct}>↑</button>
                <div />
                <button className={`${styles.btn} ${styles.dpadBtn}`} onClick={() => doMove(0, -1)} disabled={!canAct}>←</button>
                <div className={styles.dpadCenter}>·</div>
                <button className={`${styles.btn} ${styles.dpadBtn}`} onClick={() => doMove(0, 1)} disabled={!canAct}>→</button>
                <div />
                <button className={`${styles.btn} ${styles.dpadBtn}`} onClick={() => doMove(1, 0)} disabled={!canAct}>↓</button>
                <div />
              </div>

              <div className={styles.shootSection}>
                <p className={styles.shootLabel}>Shoot Arrow ({metrics.arrow} left)</p>
                <div className={styles.dpad}>
                  <div />
                  <button className={`${styles.btn} ${styles.shootBtn}`} onClick={() => doShoot(-1, 0)} disabled={!canAct || !metrics.arrow || !metrics.wumpusAlive}>↑</button>
                  <div />
                  <button className={`${styles.btn} ${styles.shootBtn}`} onClick={() => doShoot(0, -1)} disabled={!canAct || !metrics.arrow || !metrics.wumpusAlive}>←</button>
                  <span className={styles.dpadCenter} style={{ color: '#ef4444', fontSize: 18 }}>🏹</span>
                  <button className={`${styles.btn} ${styles.shootBtn}`} onClick={() => doShoot(0, 1)} disabled={!canAct || !metrics.arrow || !metrics.wumpusAlive}>→</button>
                  <div />
                  <button className={`${styles.btn} ${styles.shootBtn}`} onClick={() => doShoot(1, 0)} disabled={!canAct || !metrics.arrow || !metrics.wumpusAlive}>↓</button>
                  <div />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>

          {/* Metrics */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Real-Time Metrics</h3>
            <div className={styles.metricsGrid}>
              <MetricCard label="Inference Steps" value={metrics.inferSteps} accent="#a855f7" />
              <MetricCard label="Moves" value={metrics.moves} accent="#3b82f6" />
              <MetricCard label="KB Clauses" value={metrics.kbClauses} accent="#14b8a6" />
              <MetricCard label="Safe Cells" value={metrics.safeFound} accent="#22c55e" />
              <MetricCard label="Hazards ID'd" value={metrics.hazardsID} accent="#ef4444" />
              <MetricCard label="Arrow" value={metrics.arrow ? '✓' : '✗'} accent={metrics.arrow ? '#22c55e' : '#ef4444'} />
            </div>
          </div>

          {/* Percepts */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Current Percepts</h3>
            <div className={styles.perceptRow}>
              {!percepts.breeze && !percepts.stench && !percepts.glitter && !percepts.bump && !percepts.scream
                ? <Badge label="None" type="none" />
                : <>
                  {percepts.breeze && <Badge label="💨 Breeze" type="breeze" />}
                  {percepts.stench && <Badge label="🤢 Stench" type="stench" />}
                  {percepts.glitter && <Badge label="✨ Glitter" type="glitter" />}
                  {percepts.bump && <Badge label="💥 Bump" type="bump" />}
                  {percepts.scream && <Badge label="😱 Scream" type="scream" />}
                </>
              }
            </div>
          </div>

          {/* Agent State */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Agent State</h3>
            <div className={styles.agentState}>
              <div className={styles.stateRow}>
                <span className={styles.stateLabel}>Position</span>
                <span className={styles.stateVal}>{metrics.agentPos}</span>
              </div>
              <div className={styles.stateRow}>
                <span className={styles.stateLabel}>Gold</span>
                <span className={styles.stateVal} style={{ color: metrics.hasGold ? '#f59e0b' : '#525a78' }}>
                  {metrics.hasGold ? 'Carrying 💎' : 'Not found'}
                </span>
              </div>
              <div className={styles.stateRow}>
                <span className={styles.stateLabel}>Wumpus</span>
                <span className={styles.stateVal} style={{ color: metrics.wumpusAlive ? '#ef4444' : '#22c55e' }}>
                  {metrics.wumpusAlive ? 'Alive 👾' : 'Dead 💀'}
                </span>
              </div>
              <div className={styles.stateRow}>
                <span className={styles.stateLabel}>Status</span>
                <span className={styles.stateVal} style={{ color: !alive ? '#ef4444' : won ? '#22c55e' : '#a855f7' }}>
                  {!alive ? 'Dead' : won ? 'Won!' : 'Exploring'}
                </span>
              </div>
            </div>
          </div>

          {/* KB Log */}
          <div className={`${styles.panel} ${styles.panelGrow}`}>
            <h3 className={styles.panelTitle}>Knowledge Base Log</h3>
            <div className={styles.kbLog}>
              {game.kbLog.slice(0, 60).map((entry, i) => (
                <KBLogEntry key={i} entry={entry} />
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>Propositional Logic KB · CNF Resolution Refutation · React + Vite</span>
        <span>Arrow keys / WASD to move · Click adjacent cells on grid</span>
      </footer>
    </div>
  )
}
