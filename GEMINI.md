# Context
- **App Name:** Money Manager
- **Framework:** Next.js (App Router)
- **Architecture:** Local-first, Offline-first, Zero-backend.
- **Data & Sync:** Serverless multi-device sync via Google Drive (Local JSON + Cloud File).
- **Core Capabilities:** Personal finance tracking, conflict resolution/merge logic, financial calculations, strict payload validation.

# Tech Stack
- **State Management:** Custom React Hooks, `zustand` (optional/client state)
- **Data Validation:** `zod`
- **Forms:** `react-hook-form` + `@hookform/resolvers`
- **Utilities:** `date-fns` (dates), `lucide-react` (icons), `sonner` (toasts)
- **Testing:** `vitest`, React Testing Library

# Standards
- **Strict TDD:** Business logic (sync engine, financial calculations, CRUD) **MUST** follow Red -> Green -> Refactor. Never write production logic without an approved failing test.
- **Functional Paradigm:** Use pure functions, composition, immutability, and named exports only.
- **Strict TypeScript:** No `any`. All functions must have explicit input/output types.
- **Structure:** Feature-based architecture (`src/features/*`). Keep UI components thin; delegate to `hooks/` and `logic.ts`.
- **Error Handling:** Graceful fallbacks, explicit user feedback for sync states (offline, conflicting, syncing), and robust Zod validation for Drive payloads.
- **Git:** Use Conventional Commits.

# AI Output & Prompting Rules
- **Conserve Context Window:** Do NOT output full files, large code blocks, or complete rewrites.
- **Concise Reporting:** When modifying code, provide only a brief summary of the changes made, the specific filename, and the exact function/line modified.
- **Incremental Execution:** Work on one file or small logical group at a time. Await confirmation before proceeding to the next step.