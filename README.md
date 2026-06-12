# Poker Coach

Agent-driven Texas Hold'em learning prototype for hackathons.

## Stack

- **Vite + React + TypeScript** — frontend
- **[poker-ts](https://github.com/claudijo/poker-ts)** — game engine (dealer, betting, showdown)
- **[poker-odds-calc](https://github.com/siavashg87/poker-odds-calc)** — coach equity hints
- **Custom CSS cards** — lightweight card UI

## Agents

| Agent | Role | Location |
|-------|------|----------|
| Dealer | Hand lifecycle, button rotation | `src/agents/dealer.ts` |
| AI Players | Aggressive vs conservative strategy | `src/agents/aiPlayer.ts` |
| Coach | Pre-action advice + post-action feedback | `src/agents/coach.ts` |
| Report | End-of-hand summary | `src/agents/report.ts` |

## Workflow

1. **Start Game** — 3 players sit (You, Ace, Rock)
2. **Get cards** — hole cards dealt
3. **Decision** — when it's your turn, use action buttons
4. **Ask Coach** — explains fold/check/call/raise options
5. **Act** — coach gives immediate feedback
6. **Hand ends** — report agent shows summary
7. **Next Hand** — dealer rotates button

## Commands

```bash
npm install
npm run dev:api
npm run dev
npm run build
```

`npm run dev:api` starts the local backend on `127.0.0.1:8787` for LLM calls.
`npm run dev` starts Vite and proxies `/api` requests to that backend.

## LLM setup

Use `.env.example` as the committed template and put local values in `.env`.
Set `OPENAI_API_KEY` before running `npm run dev:api`.
Optionally override `OPENAI_MODEL`; the default is `gpt-5-mini`.
When the key is missing or an API call fails, the app falls back to deterministic local
agent logic so the demo remains playable.
Agent traces record public reasoning summaries returned by the model; raw hidden
chain-of-thought is not requested or displayed.

## Next steps (hackathon)

- Add action history replay UI
- Tune AI aggression parameters in `aiPlayer.ts`
