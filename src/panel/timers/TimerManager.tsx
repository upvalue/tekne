import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { orpc, orpcClient } from '@/api/client'
import { Button } from '@/components/vendor/Button'
import { Input } from '@/components/vendor/Input'
import { useTimerTick } from '@/editor/timer/useTimerTick'
import { elapsedMilliseconds, type Timer } from '@/docs/timer'
import { formatTimeDisplay } from '@/lib/time'
import { notifications } from '@/lib/notifications'

export const TimerManager = () => {
  const query = useQuery(
    orpc.timers.list.queryOptions({ refetchInterval: 2000 })
  )
  useTimerTick(
    query.data?.timers.some((timer) => timer.runningSince !== null) ?? false
  )
  if (query.isPending)
    return <p className="text-sm text-muted">Loading timers…</p>
  if (query.isError)
    return (
      <div role="alert">
        Timers could not be loaded.{' '}
        <Button plain onClick={() => query.refetch()}>
          Retry
        </Button>
      </div>
    )
  if (!query.data.timers.length)
    return <p className="text-sm text-muted">No active timers.</p>
  const now = query.data.serverNow + Date.now() - query.dataUpdatedAt
  return (
    <div className="space-y-4">
      {query.data.timers.map((timer) => (
        <TimerCard key={timer.id} timer={timer} now={now} />
      ))}
    </div>
  )
}

const TimerCard = ({ timer, now }: { timer: Timer; now: number }) => {
  const utils = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState(timer.noteTitle)
  const [lineId, setLineId] = useState(timer.lineId ?? '')
  const [timeMode, setTimeMode] = useState<Timer['timeMode']>(timer.timeMode)
  const pending = timer.completedAt !== null
  const document = useQuery(
    orpc.doc.loadDoc.queryOptions({
      input: { name: title },
      enabled: pending && title.length > 0,
      retry: false,
    })
  )
  const line = document.data?.doc.children.find((line) => line.id === lineId)

  const change = async (
    action: 'pause' | 'resume' | 'save' | 'discard' | 'retarget'
  ) => {
    setBusy(true)
    try {
      if (action === 'save' || action === 'retarget') {
        const detail: { flush?: Promise<void> } = {}
        window.dispatchEvent(new CustomEvent('tekne:request-save', { detail }))
        await detail.flush
      }
      const result = await orpcClient.timers.change({
        id: timer.id,
        revision: timer.revision,
        action,
        target:
          action === 'retarget' && line
            ? {
                noteTitle: title,
                lineId: line.id,
                timeMode,
                expectedTimeSeconds: line.datumTimeSeconds ?? null,
              }
            : undefined,
      })
      if (result?.completionError)
        notifications.warning(
          'Elapsed time is retained. Select a line below to save it.'
        )
    } catch (error) {
      notifications.error(
        error instanceof Error ? error.message : 'Timer could not be updated'
      )
    } finally {
      await utils.cancelQueries({ queryKey: orpc.timers.list.key() })
      await Promise.all([
        utils.invalidateQueries({ queryKey: orpc.timers.list.key() }),
        utils.invalidateQueries({ queryKey: orpc.doc.loadDoc.key() }),
        utils.invalidateQueries({
          queryKey: orpc.analysis.key(),
        }),
      ])
      setBusy(false)
    }
  }
  const elapsed = Math.floor(elapsedMilliseconds(timer, now) / 1000)
  const seconds =
    timer.mode === 'countdown' && !pending
      ? Math.max(0, timer.targetDuration - elapsed)
      : elapsed
  return (
    <section className="space-y-3 rounded-lg border border-raised p-4">
      <Link
        to="/n/$title"
        params={{ title: timer.noteTitle }}
        className="text-accent"
      >
        {timer.noteTitle}
      </Link>
      <p className="break-words text-sm">{timer.lineContent}</p>
      <p className="font-mono">
        {formatTimeDisplay(seconds)} ·{' '}
        {pending
          ? 'Finished, not saved'
          : timer.runningSince === null
            ? 'Paused'
            : timer.mode === 'countdown'
              ? 'Remaining'
              : 'Running'}
      </p>
      <fieldset disabled={busy} className="space-y-3">
        {pending ? (
          <>
            <p className="text-sm text-accent">
              {timer.completionError === 'missing_line'
                ? 'The attached line or document was deleted.'
                : 'The recorded time on this line changed while the timer was running.'}{' '}
              Your elapsed time is retained.
            </p>
            <label className="block text-sm">
              Document
              <Input
                aria-label="Target document"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  setLineId('')
                }}
              />
            </label>
            {document.isError && (
              <p role="alert" className="text-sm">
                Document could not be loaded. Check its title.
              </p>
            )}
            <label className="block text-sm">
              Line
              <select
                aria-label="Target line"
                className="mt-1 block w-full rounded border border-raised bg-page p-2"
                value={line ? lineId : ''}
                onChange={(event) => setLineId(event.target.value)}
              >
                <option value="">Choose a line</option>
                {document.data?.doc.children.map((line) => (
                  <option key={line.id} value={line.id}>
                    {'  '.repeat(Math.max(0, Math.floor(line.indent)))}
                    {line.mdContent || '(empty line)'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Recorded time
              <select
                aria-label="Time entry mode"
                className="mt-1 block w-full rounded border border-raised bg-page p-2"
                value={timeMode}
                onChange={(event) =>
                  setTimeMode(event.target.value as Timer['timeMode'])
                }
              >
                <option value="replacement">Replace existing time</option>
                <option value="additive">Add to existing time</option>
              </select>
            </label>
            {line && (
              <p className="text-sm text-text-2">
                Currently recorded:{' '}
                {formatTimeDisplay(line.datumTimeSeconds ?? 0)}
              </p>
            )}
            <Button
              disabled={!line || document.isFetching}
              onClick={() => change('retarget')}
            >
              {timeMode === 'replacement'
                ? 'Replace time on selected line'
                : 'Add time to selected line'}
            </Button>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                change(timer.runningSince === null ? 'resume' : 'pause')
              }
            >
              {timer.runningSince === null ? 'Resume' : 'Pause'}
            </Button>
            <Button onClick={() => change('save')}>Stop &amp; Save</Button>
          </div>
        )}
        <Button outline onClick={() => change('discard')}>
          Discard
        </Button>
      </fieldset>
    </section>
  )
}
