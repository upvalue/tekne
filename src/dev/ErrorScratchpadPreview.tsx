import { Tooltip } from '@/components/vendor/Tooltip'
import { CircleHelp } from 'lucide-react'
import { Button } from '@/components/vendor/Button'
import { notifications } from '@/lib/notifications'

export function ErrorScratchpadPreview() {
  return (
    <section className="space-y-3 rounded-xl border border-white/7 bg-page/40 p-4">
      <h2 className="flex items-center gap-2 font-medium">
        Notification scratch pad
        <Tooltip
          label="About this preview"
          description="Send sample messages to the app’s status line. Each disappears after five seconds and stays in History until cleared or this tab reloads."
        >
          <button
            type="button"
            aria-label="About notification samples"
            className="text-muted hover:text-text"
          >
            <CircleHelp className="size-3.5" />
          </button>
        </Tooltip>
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button
          outline
          onClick={() =>
            notifications.error('Sample: could not save changes.', {
              description: 'Your edits are still in this tab.',
            })
          }
        >
          Simulate save error
        </Button>
        <Button
          outline
          onClick={() =>
            notifications.error('Sample: search unavailable.', {
              description: 'Try again when your connection returns.',
            })
          }
        >
          Simulate search error
        </Button>
        <Button
          outline
          onClick={() =>
            notifications.error('Sample: a long error message. '.repeat(30), {
              description:
                'Request details: ' + 'long-unbroken-detail'.repeat(100),
            })
          }
        >
          Simulate long error
        </Button>
      </div>
    </section>
  )
}
