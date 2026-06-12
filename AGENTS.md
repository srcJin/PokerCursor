# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React + TypeScript Texas Hold'em coaching prototype. Application entry points live in `src/main.tsx` and `src/App.tsx`. Reusable UI components are in `src/components/`, with CSS in `src/App.css` and `src/index.css`. Game mechanics and table state live in `src/game/`; agent behavior is separated into `src/agents/` for dealer, AI player, coach, and report logic. Shared TypeScript models are in `src/types/`, React hooks in `src/hooks/`, and static assets in `public/` or `src/assets/`.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the Vite development server for local playtesting.
- `npm run dev:api`: start the local Node backend for OpenAI-backed agent calls.
- `npm run build`: run TypeScript project builds, then create the production Vite bundle in `dist/`.
- `npm run lint`: run ESLint across the repository.
- `npm run preview`: serve the built frontend locally after `npm run build`.
- `npm run start`: serve the backend and built static app from `dist/`.

## Coding Style & Naming Conventions

Use TypeScript for source files and React components. Follow the existing style: two-space indentation, semicolons, single quotes, and named exports for components and helpers. Name components in PascalCase, for example `PokerTable.tsx`; hooks in camelCase with a `use` prefix, for example `useGame.ts`; and domain modules in camelCase, for example `pokerTable.ts`. Keep poker engine logic in `src/game/` and avoid mixing UI state into agent modules.

## Testing Guidelines

No automated test framework is currently configured. Before submitting changes, run `npm run lint` and `npm run build`; these are the current regression checks. When adding tests, colocate focused unit tests next to the module they cover or place broader integration tests under `src/__tests__/`. Prefer names such as `GameSession.test.ts` or `coach.test.ts`, and prioritize deterministic tests for betting flow, legal actions, coach advice, and hand summaries.

## Commit & Pull Request Guidelines

The existing history uses short, imperative commit messages such as `Scaffold agent-driven Texas Hold'em learning prototype.` Keep future commits concise and action-oriented. Pull requests should include a brief summary, test results (`npm run lint`, `npm run build`), linked issues when relevant, and screenshots or short clips for UI changes. Call out changes to gameplay rules, agent strategy, or dependencies because they affect user-facing behavior.

## Security & Configuration Tips

Do not commit API keys or local environment files. Put local values in `.env`, keep `.env.example` current, and provide `OPENAI_API_KEY` before running `npm run dev:api`.
