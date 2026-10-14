import { useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  CircleAlert,
  CircleCheck,
  MessageSquare,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react'
import { notifications, type NotificationEntry } from '@/lib/notifications'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from './vendor/Dialog'
import { Button } from './vendor/Button'
import { Tooltip } from './vendor/Tooltip'
import { cn } from '@/lib/utils'
import { useClaimNotificationBar } from './embedded-notification-bar'

const icons = {
  error: CircleAlert,
  warning: TriangleAlert,
  success: CircleCheck,
  info: Info,
}

export function NotificationScratchpad({
  embedded = false,
  timer,
}: {
  /** Rendered as the last row of the document column instead of fixed. */
  embedded?: boolean
  timer?: ReactNode
}) {
  useClaimNotificationBar(embedded)
  const { entries, currentId } = useSyncExternalStore(
    notifications.subscribe,
    notifications.getSnapshot
  )
  const [open, setOpen] = useState(false)
  const current = entries.find((entry) => entry.id === currentId)
  const Icon = current ? icons[current.kind] : Info
  return (
    <>
      <div
        className={cn(
          'NotificationBar border-t border-white/4 bg-panel text-xs text-text-2',
          embedded ? 'flex-none' : 'fixed inset-x-0 bottom-0 z-50'
        )}
      >
        <div
          className={cn(
            'flex h-full min-w-0 items-center gap-2',
            embedded ? 'NotificationBar-column' : 'px-3'
          )}
        >
          {timer}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden"
          >
            {current && (
              <>
                <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="sr-only">{current.kind}: </span>
                <button
                  className="min-w-0 truncate text-left hover:text-text"
                  onClick={() => setOpen(true)}
                  aria-label={`View notification: ${current.message}`}
                >
                  {current.message}
                  {current.description && ` — ${current.description}`}
                </button>
              </>
            )}
          </div>
          {current?.action && <NotificationAction entry={current} />}
          <button
            aria-label="Dismiss notification"
            disabled={!current}
            onClick={notifications.dismiss}
            className="flex size-6 shrink-0 items-center justify-center text-muted enabled:hover:text-text disabled:invisible"
          >
            <X className="size-3.5" />
          </button>
          <Tooltip
            label="Messages"
            description="The latest 50 messages stay here until you reload this tab. Open a message to read its full text. Actions are available until you change pages."
          >
            <button
              className="flex shrink-0 items-center gap-1.5 tabular-nums hover:text-text"
              onClick={() => setOpen(true)}
              aria-label={`Messages (${entries.length})`}
            >
              <MessageSquare className="size-3.5" />
              <span className="hidden md:inline">
                Messages ({entries.length})
              </span>
              <span className="md:hidden">{entries.length}</span>
            </button>
          </Tooltip>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="OverlaySurface flex max-h-[min(70dvh,600px)] min-h-0 flex-col bg-panel text-text"
        >
          <div className="grid shrink-0 grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[1fr_auto_auto]">
            <DialogTitle className="min-w-0 leading-snug">Messages</DialogTitle>
            <Button
              outline
              disabled={!entries.length}
              className="col-start-1 row-start-2 justify-self-start border border-white/10 sm:col-start-2 sm:row-start-1"
              onClick={notifications.clear}
            >
              Clear history
            </Button>
            <DialogClose
              render={
                <Button
                  plain
                  aria-label="Close"
                  className="col-start-2 row-start-1 size-8 p-0 sm:col-start-3"
                >
                  <X className="size-4" />
                </Button>
              }
            />
          </div>
          {entries.length === 0 ? (
            <p className="text-sm text-muted">No notifications recorded.</p>
          ) : (
            <ol className="min-h-0 space-y-2 overflow-y-auto">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg bg-white/3 p-3 text-sm [overflow-wrap:anywhere]"
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                    <span className="capitalize">{entry.kind}</span>
                    <time dateTime={entry.at}>
                      {new Date(entry.at).toLocaleTimeString()}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap">{entry.message}</p>
                  {entry.description && (
                    <p className="mt-1 whitespace-pre-wrap text-muted">
                      {entry.description}
                    </p>
                  )}
                  {entry.action ? (
                    <div className="mt-2">
                      <NotificationAction entry={entry} />
                    </div>
                  ) : (
                    entry.actionState && (
                      <p className="mt-2 text-xs text-muted">
                        {entry.actionState === 'expired'
                          ? 'Action expired after changing pages'
                          : 'Action finished'}
                      </p>
                    )
                  )}
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function NotificationAction({ entry }: { entry: NotificationEntry }) {
  return (
    <button
      disabled={entry.actionState !== 'available'}
      onClick={() => void notifications.runAction(entry.id)}
      className="max-w-28 shrink-0 truncate rounded bg-white/7 px-2 py-1 text-xs text-accent disabled:opacity-50"
    >
      {entry.actionState === 'running' ? 'Working…' : entry.action?.label}
    </button>
  )
}
