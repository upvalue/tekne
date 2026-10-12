import { useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Popover,
  PopoverButton,
  PopoverPanel,
} from '@/components/vendor/Popover'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const dateFor = (value: string) => new Date(`${value}T12:00:00`)
const offsetDay = (value: string, offset: number) => {
  const date = dateFor(value)
  date.setDate(date.getDate() + offset)
  return formatDate(date)
}

export function DateNavigation({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(value.slice(0, 7))
  const calendar = useRef<HTMLDivElement>(null)
  const first = dateFor(`${month}-01`)
  const start = offsetDay(formatDate(first), -(first.getDay() + 6) % 7)
  const days = Array.from({ length: 42 }, (_, index) => offsetDay(start, index))
  const today = formatDate(new Date())
  const choose = (date: string) => {
    onChange(date)
    setOpen(false)
  }
  const moveMonth = (offset: number) => {
    const date = dateFor(`${month}-01`)
    date.setMonth(date.getMonth() + offset)
    setMonth(formatDate(date).slice(0, 7))
  }
  return (
    <nav
      aria-label="Date navigation"
      className="flex items-center gap-1 text-muted h-6 mb-2"
    >
      <button
        aria-label="Previous day"
        title="Previous day"
        className="rounded p-1 hover:bg-white/5 hover:text-text"
        onClick={() => onChange(offsetDay(value, -1))}
      >
        <ChevronLeft size={16} />
      </button>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setMonth(value.slice(0, 7))
        }}
      >
        <PopoverButton
          aria-label="Calendar"
          title="Choose date"
          className="rounded p-1 hover:bg-white/5 hover:text-text"
        >
          <CalendarDays size={16} />
        </PopoverButton>
        <PopoverPanel
          className="OverlaySurface w-64 p-3 text-sm"
          aria-label="Choose date"
          initialFocus={() =>
            calendar.current?.querySelector<HTMLButtonElement>(
              `[data-date="${value}"]`
            ) ?? null
          }
        >
          <div className="flex items-center justify-between mb-2">
            <button
              aria-label="Previous month"
              className="p-1 text-muted hover:text-text"
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-medium">
              {first.toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <button
              aria-label="Next month"
              className="p-1 text-muted hover:text-text"
              onClick={() => moveMonth(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div
            ref={calendar}
            className="grid grid-cols-7 gap-0.5"
            onKeyDown={(event) => {
              const date = (event.target as HTMLElement).dataset.date
              const offset = {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -7,
                ArrowDown: 7,
              }[event.key]
              if (!date || offset === undefined) return
              event.preventDefault()
              const next = offsetDay(date, offset)
              if (!days.includes(next)) setMonth(next.slice(0, 7))
              requestAnimationFrame(() =>
                calendar.current
                  ?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)
                  ?.focus()
              )
            }}
          >
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
              <span
                key={index}
                className="text-center py-1 text-xs text-muted"
                aria-hidden="true"
              >
                {day}
              </span>
            ))}
            {days.map((date) => (
              <button
                key={date}
                data-date={date}
                aria-label={date}
                aria-pressed={date === value}
                aria-current={date === today ? 'date' : undefined}
                onClick={() => choose(date)}
                className={cn(
                  'rounded py-1.5 text-xs tabular-nums hover:bg-white/7 focus-visible:outline-2 focus-visible:outline-accent',
                  date === value
                    ? 'bg-accent-tint text-accent'
                    : date.slice(0, 7) === month
                      ? 'text-text-2'
                      : 'text-muted/60',
                  date === today && 'font-bold underline underline-offset-4'
                )}
              >
                {Number(date.slice(-2))}
              </button>
            ))}
          </div>
          <button
            className="mt-2 w-full rounded bg-white/5 py-1.5 text-text-2 hover:bg-white/9"
            onClick={() => choose(today)}
          >
            Today
          </button>
        </PopoverPanel>
      </Popover>
      <button
        aria-label="Next day"
        title="Next day"
        className="rounded p-1 hover:bg-white/5 hover:text-text"
        onClick={() => onChange(offsetDay(value, 1))}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}
