// AgentPanel.tsx - Instruct an LLM agent to propose edits to the current
// document, review the proposal as a live diff, and apply or discard it.
//
// The agent loop and its edit tool run in this tab against a draft copy of
// the doc; only the LLM call is relayed through the server. Applying is a
// single docAtom write (one undo entry); the route's autosave persists it.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useStore } from 'jotai'
import { toast } from 'sonner'
import { CircleStop, Sparkles } from 'lucide-react'
import { Button } from '@/components/vendor/Button'
import { docAtom } from '@/editor/state'
import { diffDocs, proposalSummary } from '@/docs/doc-diff'
import { applyEditOps } from '@/agent/edit-ops'
import { serializeDocForPrompt } from '@/agent/serialize'
import {
  createAgentSession,
  type AgentSession,
  type TranscriptEntry,
} from '@/agent/session'
import {
  fetchAgentAvailability,
  resolveAgentProxy,
  type AgentAvailability,
} from '@/agent/config'
import { ChangeRows } from '@/panel/diff/ChangeRows'
import type { ZDoc } from '@/docs/schema'

/** Above this many serialized bytes, warn that the doc is large (cost). */
const LARGE_DOC_BYTES = 150_000

const Unavailable = ({ reason }: { reason?: string }) => (
  <div className="p-4 text-sm text-zinc-400">
    <p className="mb-2 font-medium text-zinc-300">Agent unavailable</p>
    <p>
      The agent needs the tekne server with an <code>LLM_API_KEY</code>{' '}
      configured{reason ? ` (${reason})` : ''}. In development, run{' '}
      <code>pnpm dev:client-and-server</code>.
    </p>
  </div>
)

const TranscriptView = ({
  transcript,
  thinking,
}: {
  transcript: TranscriptEntry[]
  thinking: boolean
}) => (
  <div className="space-y-2">
    {transcript.map((entry, idx) =>
      entry.kind === 'text' ? (
        entry.text.trim() !== '' && (
          <div key={idx} className="whitespace-pre-wrap text-sm text-zinc-300">
            {entry.text}
          </div>
        )
      ) : (
        <div key={idx}>
          <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
            <Sparkles className="size-3" />
            edit · {entry.opCount} op{entry.opCount === 1 ? '' : 's'}
            {entry.failures > 0 && (
              <span className="text-red-400">({entry.failures} failed)</span>
            )}
          </span>
        </div>
      )
    )}
    {thinking && (
      <div className="animate-pulse text-sm text-zinc-500">Thinking…</div>
    )}
  </div>
)

const ActiveSession = ({
  session,
  baseDoc,
  onDone,
}: {
  session: AgentSession
  baseDoc: ZDoc
  onDone: () => void
}) => {
  const store = useStore()
  const state = useSyncExternalStore(session.subscribe, session.getState)
  const [followUp, setFollowUp] = useState('')

  const changes = useMemo(
    () => diffDocs(baseDoc, session.getDraft()),
    // draftVersion is the draft's change counter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, baseDoc, state.draftVersion]
  )

  const apply = () => {
    const current = store.get(docAtom)
    let next: ZDoc
    if (current === baseDoc) {
      next = session.getDraft()
    } else {
      // The user edited the doc while the agent ran: replay the recorded
      // ops onto the current doc. Id-addressed ops only fail if the user
      // deleted the exact line an op targets.
      const replay = applyEditOps(current, session.getOps())
      next = replay.doc
      const failed = replay.results.filter((r) => !r.ok).length
      if (failed > 0) {
        toast.warning(
          `${failed} edit${failed === 1 ? '' : 's'} no longer applied cleanly and ${failed === 1 ? 'was' : 'were'} skipped`
        )
      }
    }
    store.set(docAtom, next)
    window.dispatchEvent(new CustomEvent('tekne:request-save', { detail: {} }))
    onDone()
  }

  const discard = () => {
    session.abort()
    onDone()
  }

  const running = state.status === 'running'

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <TranscriptView transcript={state.transcript} thinking={state.thinking} />

      {state.error && (
        <div className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {state.error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-800">
        <div className="border-b border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-400">
          {proposalSummary(changes)}
        </div>
        <ChangeRows changes={changes} />
      </div>

      {running ? (
        <div className="flex items-center gap-2">
          <Button outline onClick={() => session.abort()}>
            <CircleStop data-slot="icon" />
            Stop
          </Button>
          <span className="text-xs text-zinc-500">Working…</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              color="green"
              disabled={changes.length === 0}
              onClick={apply}
            >
              Apply
            </Button>
            <Button outline onClick={discard}>
              Discard
            </Button>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (followUp.trim() === '') return
              session.send(followUp.trim())
              setFollowUp('')
            }}
          >
            <input
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 placeholder:text-zinc-500"
              placeholder="Follow up to refine the proposal…"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
            />
            <Button outline type="submit" disabled={followUp.trim() === ''}>
              Send
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}

export const AgentPanel = () => {
  const store = useStore()
  const proxy = useMemo(resolveAgentProxy, [])
  const [availability, setAvailability] = useState<
    AgentAvailability | 'loading'
  >(proxy.available ? 'loading' : { available: false })
  const [instruction, setInstruction] = useState('')
  const [active, setActive] = useState<{
    session: AgentSession
    baseDoc: ZDoc
  } | null>(null)

  useEffect(() => {
    if (!proxy.available) return
    let cancelled = false
    void fetchAgentAvailability(proxy.baseUrl).then((result) => {
      if (!cancelled) setAvailability(result)
    })
    return () => {
      cancelled = true
    }
  }, [proxy])

  if (availability !== 'loading' && !availability.available) {
    return <Unavailable reason={availability.reason} />
  }

  if (active) {
    return (
      <ActiveSession
        session={active.session}
        baseDoc={active.baseDoc}
        onDone={() => {
          setActive(null)
          setInstruction('')
        }}
      />
    )
  }

  const start = () => {
    const baseDoc = store.get(docAtom)
    const session = createAgentSession({ baseDoc, proxyUrl: proxy.baseUrl })
    session.start(instruction.trim())
    setActive({ session, baseDoc })
  }

  const docBytes = new TextEncoder().encode(
    serializeDocForPrompt(store.get(docAtom))
  ).length

  return (
    <form
      className="flex flex-col gap-3 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (instruction.trim() !== '' && availability !== 'loading') start()
      }}
    >
      <p className="text-sm text-zinc-400">
        Describe a change to this document. The agent proposes edits as a diff;
        nothing is applied until you accept it.
      </p>
      <textarea
        className="min-h-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500"
        placeholder="e.g. Reword the top section to be terser, and group the loose tasks under a heading"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
      />
      {docBytes > LARGE_DOC_BYTES && (
        <p className="text-xs text-amber-400">
          This document is large (~{Math.round(docBytes / 1024)} KB); the agent
          reads all of it on every request.
        </p>
      )}
      <div>
        <Button
          type="submit"
          disabled={instruction.trim() === '' || availability === 'loading'}
        >
          <Sparkles data-slot="icon" />
          Propose edits
        </Button>
      </div>
    </form>
  )
}
