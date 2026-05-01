# Wumpus World — Knowledge-Based Agent

A web-based implementation of the Wumpus World problem using Propositional Logic and Resolution Refutation.

## Features

- **Dynamic Grid**: Configurable rows × columns × pit count
- **KB Inference Engine**: Propositional Logic KB with CNF Resolution Refutation
- **Real-Time Metrics**: Inference steps, KB clause count, moves, hazards identified
- **Auto-Play**: Agent navigates autonomously using KB inferences
- **Dark Cave UI**: Professional dark-themed interface with keyboard controls

## Tech Stack

- React 18 + Vite
- CSS Modules
- No external UI dependencies

## Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:5173`

## Deploy to Vercel

### Option A — Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option B — GitHub + Vercel Dashboard
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your repo — Vite is auto-detected
4. Click Deploy

## How It Works

### Knowledge Base
- **TELL**: When the agent perceives Breeze at (r,c), it adds clause: `B_{r,c} ⟺ P_{adj1} ∨ P_{adj2} ∨ ...`
- **TELL**: No breeze → all adjacent cells are immediately marked safe: `¬P_{adj}`

### Resolution Refutation
- Converts KB to CNF
- If all candidates in a Breeze clause except one are proven safe → that one MUST be a pit
- If a pit is confirmed in a Breeze clause → all other candidates in that clause are safe
- Same logic for Wumpus/Stench clauses
- Iterates until no new inferences can be made

## Controls

| Action | Input |
|--------|-------|
| Move | Arrow keys / WASD / Click adjacent cell |
| Auto-play | Auto Play button |
| Shoot Arrow | Shoot direction buttons |
| New Game | New Game button |
