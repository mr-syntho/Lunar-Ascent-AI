# AI Assistant

## Overview

A full-stack AI assistant web app with a neumorphic design that routes queries to different AI services based on task type. Built with React + Vite frontend and Express backend.

## Features

- **Multi-mode AI**: Search, Code generation, Summarization, and Image generation
- **Optional URL input**: Paste any public URL and the AI will extract and analyze its content
- **Neumorphic UI**: Soft, tactile 3D-style design with light/dark mode toggle
- **History**: All queries are saved and viewable in a collapsible sidebar
- **Usage stats**: Shows total query counts broken down by task type

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (neumorphic design)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI GPT-5.2 + DALL-E image generation via Replit AI Integrations
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Architecture

- `artifacts/ai-assistant/` — React + Vite frontend with neumorphic UI
- `artifacts/api-server/` — Express backend with AI routing logic
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod validation schemas
- `lib/db/` — Drizzle ORM + PostgreSQL schema
- `lib/integrations-openai-ai-server/` — OpenAI server-side integration

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## AI Task Routing

| Task Type | AI Model | Simulated Sources |
|-----------|----------|-------------------|
| Search | GPT-5.2 | Google Search AI, Deepseek AI, Bing AI |
| Code | GPT-5.2 | OpenAI Codex, Claude Code, GitHub Copilot |
| Summarize | GPT-5.2 | GPT AI, Claude AI, LLaMA AI |
| Image | DALL-E (gpt-image-1) | DALL-E AI, Stable Diffusion, NanoBanana AI |

## API Endpoints

- `POST /api/ai/query` — Send a query (routes to correct AI based on task type)
- `GET /api/ai/history` — Get query history
- `DELETE /api/ai/history/:id` — Delete a history item
- `DELETE /api/ai/history/clear` — Clear all history
- `GET /api/ai/stats` — Get usage statistics
