# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup      # First-time setup: install deps + Prisma generate + DB migrations
npm run dev        # Start dev server with Turbopack at http://localhost:3000
npm run build      # Production build
npm run lint       # ESLint
npm run test       # Run all Vitest tests
npm run db:reset   # Reset SQLite database (destructive)
```

Run a single test file:
```bash
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx
```

Tests use Vitest with jsdom environment and the React plugin (`vitest.config.mts`).

## Architecture

UIGen is an AI-powered React component generator. Users describe components in chat, Claude generates the code, and the app provides a live preview — all without writing files to disk.

### Data Flow

```
User message → /api/chat (streaming) → Claude tool calls → Virtual FS → Preview iframe + Code editor
```

For authenticated users, the final file system state is saved to SQLite via a `onFinish` callback. Anonymous users get sessionStorage-only tracking (`src/lib/anon-work-tracker.ts`).

### Key Abstractions

**Virtual File System** (`src/lib/file-system.ts`): In-memory file store (no disk I/O). Serializable for database persistence. AI tools operate on this.

**AI Tools** (`src/lib/tools/`): Claude has two tools — `str_replace_editor` for targeted edits and `file_manager` for create/delete/rename. Both mutate the virtual FS.

**System Prompt** (`src/lib/prompts/generation.tsx`): Instructs Claude to use `/App.jsx` as the component entrypoint and Tailwind CSS for styling. Modify this to change generation behavior.

**JSX Transformer** (`src/lib/transform/jsx-transformer.ts`): Babel standalone transforms JSX to runnable JS. Generates import maps pointing to `esm.sh` CDN so the preview iframe can load React and other packages without a bundler.

**Provider** (`src/lib/provider.ts`): Abstracts the LLM — uses `claude-haiku-4-5` via Anthropic SDK (with prompt caching on the system message), or a mock provider if `ANTHROPIC_API_KEY` is not set. The real provider allows up to 40 tool-call steps; the mock allows 4.

**Contexts** (`src/lib/contexts/`): `chat-context.tsx` wraps Vercel AI SDK's `useChat`; `file-system-context.tsx` manages virtual FS state and exposes it to the editor and preview.

### UI Layout

Three-panel resizable layout (`src/app/main-content.tsx`):
- **Left**: Chat interface (ChatInterface → MessageList + MessageInput)
- **Right top**: Live preview iframe (PreviewFrame)
- **Right bottom**: Monaco code editor + file tree (CodeEditor + FileTree)

Tabs allow toggling between Preview and Code views.

### Auth & Persistence

JWT sessions (7-day, managed via `jose` in `src/lib/auth.ts`). Server actions in `src/actions/` handle sign-up/sign-in/sign-out and project CRUD. Prisma with SQLite (`prisma/schema.prisma`) stores `User` and `Project` models. Projects store the serialized virtual FS state as JSON strings in the `data` column.

The Prisma client is generated to `src/generated/prisma` (non-default path) — import from there, not `@prisma/client`.

`src/middleware.ts` protects `/api/projects` and `/api/filesystem` routes via JWT verification.

UI components: shadcn/ui (new-york style) on Tailwind CSS v4, icons via lucide-react, panel resizing via react-resizable-panels.

### Path Alias

`@/*` maps to `./src/*` throughout the codebase.

## Code Style

- Use comments sparingly. Only comment complex code.

## Environment Variables

- `ANTHROPIC_API_KEY`: Required for real AI generation; falls back to MockLanguageModel if unset.
- `JWT_SECRET`: Defaults to `"development-secret-key"` if unset (change in production).

## Node.js Compatibility

All npm scripts prepend `NODE_OPTIONS="--require ./node-compat.cjs"` to fix a Web Storage SSR crash on Node 25+. If you see `localStorage.getItem is not a function` during SSR, this is why.
