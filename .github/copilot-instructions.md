# Copilot / AI Agent Instructions for Tayyari-hub

Purpose: Short, actionable guidance so AI coding agents are immediately productive in this repo.

Quick start
- Dev: `npm run dev` (Next dev server)
- Build: `npm run build` then `npm start` for production server behavior; `postbuild` runs `next-sitemap`.
- Lint: `npm run lint`

Big picture
- Next.js (App Router) app under `app/` (server and client components). Root layout: `app/layout.tsx`.
- UI: reusable primitives live in `components/ui/` and composed pieces in `components/Home/`.
- State: client state uses Zustand stores in `stores/` (`useUserStore.ts`, `useUIStore.ts`). `useUserStore` is persisted to localStorage under key `user-storage`.
- Auth & Data: Firebase client SDK initialized at `app/firebase.ts`. Server-side functions use `firebase-admin` and Cloud Functions (see `runBatches.js` calling a Cloud Function URL).
- API: lightweight Next API routes under `api/` (inspect `api/quizzes`, `api/students` for patterns).

Key patterns and conventions
- App Router & 'use client': Place `use client` at top of client components (see `app/admin/layout.tsx`). Server components should avoid client-only imports.
- Auth gating: `app/admin/layout.tsx` enforces admin access and whitelists certain student-accessible admin routes — follow this pattern when adding protected pages.
- Zustand usage: Keep stores in `stores/`. Actions and computed helpers are preferred over ad-hoc useState. Persist only minimal state (see `partialize` in `useUserStore`).
- Firebase: `app/firebase.ts` contains the client config — do not change keys in code unless rotating credentials. For server work use `firebase-admin` and environment-managed credentials.
- Styling: Tailwind CSS (see `tailwind.config.ts`) and utility-first classes are used across components.

Build & debugging tips
- Reproduce production behaviors with `npm run build`. Production-only integrations (Vercel Analytics, SpeedInsights) are gated in `app/layout.tsx`.
- To debug auth flows, check console logs inserted in `app/admin/layout.tsx` and inspect `users` documents in Firestore.
- Background batches: `runBatches.js` demonstrates how Cloud Functions are invoked and paginated — useful for maintenance scripts.

Files to inspect for examples
- `app/firebase.ts` — Firebase client initialization
- `app/admin/layout.tsx` — auth gating, whitelisting, and Zustand usage
- `stores/useUserStore.ts`, `stores/useUIStore.ts` — state patterns and persistence
- `components/ui/` — low-level UI primitives used across the app
- `runBatches.js` — example of serverless batch invocation

What not to change without confirmation
- Firebase project keys and server credentials (use env vars or CI secrets instead)
- Global layout patterns (app router, ThemeProvider usage in `app/layout.tsx`)

If you need more details
- Ask for specifics you want automated (PRs, refactors, tests). If any runtime secrets or CI steps are missing from the repo, request them before making changes that rely on them.

Finished: draft created. Request feedback and clarify missing credentials, CI, or deployment details for further updates.
