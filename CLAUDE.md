# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps + prisma generate + migrate
npm run dev          # Dev server on http://localhost:3000 (Turbopack)
npm run dev:daemon   # Dev server in background, logs to logs.txt
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest in watch mode
npm test -- run      # Vitest single run
npm run db:reset     # Wipe and re-migrate SQLite database
```

For a specific test file or directory:
```bash
npm test -- src/lib/__tests__/file-system.test.ts
npm test -- src/lib
```

Test files live under `__tests__/` folders colocated with the code they test. Coverage spans `src/lib/` (file-system, jsx-transformer, contexts) and `src/components/` (chat, editor).

Database changes:
```bash
# Edit prisma/schema.prisma, then:
npx prisma generate   # outputs client to src/generated/prisma (non-default path)
npx prisma migrate dev
```

## Environment Variables

- `ANTHROPIC_API_KEY` — optional; omit to use `MockLanguageModel` for development without credentials
- `JWT_SECRET` — required in production; defaults to `"development-secret-key"` in dev

## Architecture

UIGen is a Next.js 15 App Router app where users describe React components in natural language and Claude generates them with live preview.

### Request Flow

1. User submits prompt in `ChatInterface` → Vercel's `useAIChat` hook POSTs to `/api/chat` with messages and the full serialized virtual FS (`body.files`). The FS is round-tripped on every submission — the server is stateless between HTTP requests and reconstructs it each time.
2. `/api/chat/route.ts` reconstructs the VirtualFileSystem from `body.files`, builds the system prompt, and calls Claude via `streamText()` with two tools: `str_replace_editor` and `file_manager`. The reconstructed FS instance persists across all steps within a single `streamText()` call.
3. Claude iterates up to `maxSteps: 40` (4 for the mock) with `maxTokens: 10000`, making tool calls to create/edit files in the server-side FS
4. Each streamed tool call fires `onToolCall` in `ChatContext`, which delegates to `FileSystemContext.handleToolCall()`, updating the client-side in-memory FS and calling `triggerRefresh()`
5. `PreviewFrame` detects FS changes via `refreshTrigger`, finds the entry point (App.jsx/tsx, index.jsx/tsx, src/App.jsx/tsx in that priority order), and re-renders via Babel Standalone JSX transpilation inside an iframe
6. On finish, if the user is authenticated and a `projectId` was sent, the full message history and final FS state are saved to the `Project` row in SQLite via Prisma

### Key Abstractions

**VirtualFileSystem** (`src/lib/file-system.ts`): In-memory tree (Map<string, FileNode>). Serializes to/from JSON for DB persistence and HTTP transport. Powers the file tree UI, Monaco editor, and Babel transpilation.

**AI Provider** (`src/lib/provider.ts`): `getLanguageModel()` returns `anthropic("claude-haiku-4-5")` if `ANTHROPIC_API_KEY` is set, or a `MockLanguageModel` otherwise. The mock detects keywords in the prompt (`counter`/`form`/`card`) to pick a component type; any other input defaults to a counter. It runs a fixed 4-step sequence regardless of input.

**AI Tools** (`src/lib/tools/`): Zod schemas for the two tools exposed to Claude. `str_replace_editor` supports `view`, `create`, `str_replace`, `insert`, and `undo_edit` commands — `undo_edit` is accepted by the schema but intentionally unimplemented (returns an error). `file_manager` supports `rename` and `delete`. The system prompt lives in `src/lib/prompts/generation.tsx`.

**System Prompt Rules** (`src/lib/prompts/generation.tsx`): Claude is instructed to (a) always create `/App.jsx` first as the root entry point with a default export, (b) use `@/` for all local imports within the virtual FS (e.g., `import Button from '@/components/Button'`), and (c) use only Tailwind CSS for styling — no hardcoded styles, no HTML files.

**React Contexts**:
- `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`): owns the VirtualFileSystem instance, selected file, and `handleToolCall()` dispatch. Calls `triggerRefresh()` after every FS mutation to force re-renders.
- `ChatContext` (`src/lib/contexts/chat-context.tsx`): wraps `useAIChat`, passes serialized FS as `body.files` on every request

**JSX Preview** (`src/lib/transform/jsx-transformer.ts`): `createPreviewHTML()` uses Babel Standalone to transpile JSX and generates an import map (esm.sh CDN) for module resolution inside the iframe. The `@/` alias used inside the virtual FS maps to the virtual root `/` in the import map — this is distinct from the Next.js project's own `@/` → `src/` alias. CSS imports are stripped. No build step required.

**Authentication** (`src/lib/auth.ts`): JWT stored in an httpOnly cookie (7-day expiry via `jose`). `verifySession()` is used in server actions and API routes. Anonymous users work in-memory only; `anon-work-tracker.ts` uses sessionStorage to track whether they have unsaved work.

**Server Actions** (`src/actions/`): `signUp`, `signIn`, `signOut`, `getUser` for auth; `createProject`, `getProject`, `getProjects` for persistence. All Prisma queries are confined here or in API routes.

### Layout

The UI is two resizable panels (react-resizable-panels):
- Left (35%): Chat (messages + input)
- Right (65%): Tabs — Preview (iframe) | Code (FileTree + Monaco)

### Database Schema

```prisma
User    { id, email, password, projects[] }
Project { id, name, userId, messages String (JSON), data String (JSON) }
```

`messages` stores the full Vercel AI SDK message array. `data` stores the serialized VirtualFileSystem. Both are raw JSON strings, not structured columns.

## Important Conventions

- Use the `@/*` path alias for all internal imports in the Next.js source (maps to `src/`). This is different from the `@/` alias used inside generated virtual FS files, which maps to the FS root `/`.
- Client components require `"use client"`; server actions require `"use server"`
- Prisma queries belong only in server actions (`src/actions/`) or API routes
- Test stack is Vitest + React Testing Library + jsdom; colocate tests in `__tests__/` folders next to the code they test
- Prisma client is generated to `src/generated/prisma` (not `node_modules/@prisma/client`) — import from `@/generated/prisma`
- Styling: Tailwind CSS v4 + `cn()` from `src/lib/utils.ts`; avoid inline styles
- The system prompt in `/api/chat/route.ts` uses `providerOptions.anthropic.cacheControl` (`ephemeral`) on the system message only — preserve this when editing the route
- `node-compat.cjs` (loaded via `NODE_OPTIONS`) patches Node 25+ Web Storage globals to prevent SSR crashes; do not remove it
