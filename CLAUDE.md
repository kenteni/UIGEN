# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup          # First-time setup: install deps, generate Prisma client, run migrations
npm run dev            # Dev server with Turbopack on localhost:3000
npm run build          # Production build
npm run lint           # ESLint
npm run test           # Vitest unit tests
npm run db:reset       # Reset SQLite database
```

All scripts prepend `NODE_OPTIONS='--require ./node-compat.cjs'` for Node.js compatibility — the `node-compat.cjs` shim must stay in place.

## Architecture

**UIGen** is an AI-powered React component generator with a three-panel layout: chat, code editor, and live preview.

### Request Flow

1. User sends a message via the chat panel → `/api/chat` route streams a response using Vercel AI SDK + Anthropic Claude
2. The model calls two tools during generation: `str_replace_editor` (create/edit files) and `file_manager` (rename/delete)
3. Tool calls update the **VirtualFileSystem** (in-memory, no disk I/O) via `FileSystemContext`
4. The preview panel compiles JSX at runtime using Babel Standalone and renders the result in an iframe

### Key Modules

- `src/app/api/chat/route.ts` — Streaming AI endpoint; runs an agentic loop (max 40 steps for real API, 4 for mock)
- `src/lib/file-system.ts` — `VirtualFileSystem` class: in-memory file tree, serializable to JSON for DB persistence
- `src/lib/provider.ts` — Initializes `anthropic()` model or falls back to `MockLanguageModel` when `ANTHROPIC_API_KEY` is absent
- `src/lib/prompts/generation.tsx` — System prompt sent with every chat request; controls component generation style
- `src/app/main-content.tsx` — Root layout with resizable panels (react-resizable-panels)
- `src/app/[projectId]/page.tsx` — Project route; loads saved state for authenticated users

### AI Integration

- Uses `@ai-sdk/anthropic` + `@ai-sdk/react` (`useChat` hook) with streaming and tool calling
- Prompt caching is enabled via `anthropic.languageModel` with `cacheControl: 'ephemeral'` on the system prompt
- The mock provider (`MockLanguageModel`) generates minimal placeholder components so the app works without an API key

### Authentication & Persistence

- JWT sessions stored in httpOnly cookies (7-day expiry); `src/lib/auth.ts` handles signing/verification
- Prisma + SQLite (`prisma/schema.prisma`): `User` and `Project` models; projects store `messages` and file system `data` as serialized JSON
- Anonymous users can use the full editor; their work lives in localStorage and is not saved to the DB
- Middleware at `src/middleware.ts` protects `/api/projects` and `/api/filesystem` routes

### Virtual File System

- Files live only in memory; the `@/` import alias resolves to non-library files within the virtual FS
- The preview iframe imports from the virtual FS via a custom module resolver, not the real filesystem
- Co-located test files live in `__tests__` subdirectories beside the component they test

- Use comments sparingly. Only comment complex code
