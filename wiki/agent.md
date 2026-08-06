# Document-edit agent

The Agent panel tab (command palette → "Agent") lets an LLM propose edits to
the current document. The agent runs a small tool loop in the browser with a
single `edit` tool against a draft copy of the doc; proposals render as a
live red/green diff and nothing touches the document until Apply, which is a
single undo step.

## Architecture

- `src/agent/` — pure logic + the pi session. `edit-ops.ts` (the op schema
  and applier), `serialize.ts`/`prompt.ts` (what the model sees),
  `session.ts` (wraps `@earendil-works/pi-agent-core`'s `Agent` with the
  `edit` tool and pi's `streamProxy`), `config.ts` (relay discovery).
- `src/server/agent-stream.ts` — the only place credentials live. Express
  routes `POST /api/stream` (SSE relay: runs pi-ai `models.stream()` and
  forwards slim proxy events) and `GET /api/agent/config` (availability
  probe). Registered before the app-wide `express.json()` so it can accept
  larger bodies; SSE uses `Cache-Control: no-transform` to bypass
  `compression()`.
- `src/panel/agent/AgentPanel.tsx` — the UI; `src/panel/diff/ChangeRows.tsx`
  is the shared red/green diff row list (also used by the tag-rename
  dialog), fed by `src/docs/doc-diff.ts`.

## Configuration (server-side env, `.env` / `.env.production`)

| Variable      | Default                        | Meaning                               |
| ------------- | ------------------------------ | ------------------------------------- |
| `LLM_API_KEY` | — (feature disabled if unset)  | API key sent to the LLM endpoint      |
| `LLM_API_URL` | `https://openrouter.ai/api/v1` | Any OpenAI-compatible base URL        |
| `LLM_MODEL`   | `openai/gpt-5.6-luna`          | Model id (OpenRouter slug by default) |

The model is resolved on the server only; the client never knows the
provider. Swapping providers or models is an `.env` edit, no code change.
Never prefix these with `VITE_`/`TEKNE_` — that would expose them to the
client bundle.

## Dev notes

- `pnpm dev:client-only` has no server process, so the panel shows its
  "agent unavailable" state there. Use `pnpm dev:client-and-server` (or
  `dev:all`).
- The client finds the relay the same way tRPC finds its endpoint: same
  origin in prod, the `TEKNE_TRPC_URL` origin otherwise.
- If the user edits the document while the agent runs, Apply replays the
  recorded ops (addressed by line id) onto the current doc; ops whose target
  line was deleted are skipped with a toast.
