import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import clsx from 'clsx'
import type React from 'react'

export function SwitchGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="control"
      {...props}
      className={clsx(
        className,
        // Basic groups
        'space-y-3 **:data-[slot=label]:font-normal',
        // With descriptions
        'has-data-[slot=description]:space-y-6 has-data-[slot=description]:**:data-[slot=label]:font-medium'
      )}
    />
  )
}

export function SwitchField({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="field"
      {...props}
      className={clsx(
        className,
        // Base layout
        'grid grid-cols-[1fr_auto] gap-x-8 gap-y-1 sm:grid-cols-[1fr_auto]',
        // Control layout
        '*:data-[slot=control]:col-start-2 *:data-[slot=control]:self-start sm:*:data-[slot=control]:mt-0.5',
        // Label layout
        '*:data-[slot=label]:col-start-1 *:data-[slot=label]:row-start-1',
        // Description layout
        '*:data-[slot=description]:col-start-1 *:data-[slot=description]:row-start-2',
        // With description
        'has-data-[slot=description]:**:data-[slot=label]:font-medium'
      )}
    />
  )
}

const colors = {
  'dark/zinc': [
    '[--switch-bg-ring:var(--color-page)]/90 [--switch-bg:var(--color-page)] dark:[--switch-bg-ring:transparent] dark:[--switch-bg:var(--color-white)]/25',
    '[--switch-ring:var(--color-page)]/90 [--switch-shadow:var(--color-black)]/10 [--switch:white] dark:[--switch-ring:var(--color-raised)]/90',
  ],
  'dark/white': [
    '[--switch-bg-ring:var(--color-page)]/90 [--switch-bg:var(--color-page)] dark:[--switch-bg-ring:transparent] dark:[--switch-bg:var(--color-white)]',
    '[--switch-ring:var(--color-page)]/90 [--switch-shadow:var(--color-black)]/10 [--switch:white] dark:[--switch-ring:transparent] dark:[--switch:var(--color-page)]',
  ],
  dark: [
    '[--switch-bg-ring:var(--color-page)]/90 [--switch-bg:var(--color-page)] dark:[--switch-bg-ring:var(--color-white)]/15',
    '[--switch-ring:var(--color-page)]/90 [--switch-shadow:var(--color-black)]/10 [--switch:white]',
  ],
  zinc: [
    '[--switch-bg-ring:var(--color-raised)]/90 [--switch-bg:var(--color-muted)] dark:[--switch-bg-ring:transparent]',
    '[--switch-shadow:var(--color-black)]/10 [--switch:white] [--switch-ring:var(--color-raised)]/90',
  ],
  white: [
    '[--switch-bg-ring:var(--color-black)]/15 [--switch-bg:white] dark:[--switch-bg-ring:transparent]',
    '[--switch-shadow:var(--color-black)]/10 [--switch-ring:transparent] [--switch:var(--color-page)]',
  ],
  red: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  orange: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  amber: [
    '[--switch-bg-ring:var(--color-accent-fill)]/80 [--switch-bg:var(--color-accent)] dark:[--switch-bg-ring:transparent]',
    '[--switch-ring:transparent] [--switch-shadow:transparent] [--switch:var(--color-accent-tint)]',
  ],
  yellow: [
    '[--switch-bg-ring:var(--color-accent)]/80 [--switch-bg:var(--color-accent)] dark:[--switch-bg-ring:transparent]',
    '[--switch-ring:transparent] [--switch-shadow:transparent] [--switch:var(--color-accent-tint)]',
  ],
  lime: [
    '[--switch-bg-ring:var(--color-accent)]/80 [--switch-bg:var(--color-accent)] dark:[--switch-bg-ring:transparent]',
    '[--switch-ring:transparent] [--switch-shadow:transparent] [--switch:var(--color-accent-tint)]',
  ],
  green: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  emerald: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  teal: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  cyan: [
    '[--switch-bg-ring:var(--color-accent)]/80 [--switch-bg:var(--color-accent)] dark:[--switch-bg-ring:transparent]',
    '[--switch-ring:transparent] [--switch-shadow:transparent] [--switch:var(--color-accent-tint)]',
  ],
  sky: [
    '[--switch-bg-ring:var(--color-accent-fill)]/80 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/80 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  blue: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  indigo: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  violet: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  purple: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  fuchsia: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  pink: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
  rose: [
    '[--switch-bg-ring:var(--color-accent-fill)]/90 [--switch-bg:var(--color-accent-fill)] dark:[--switch-bg-ring:transparent]',
    '[--switch:white] [--switch-ring:var(--color-accent-fill)]/90 [--switch-shadow:var(--color-accent-tint)]/20',
  ],
}

type Color = keyof typeof colors

export function Switch({
  color = 'dark/zinc',
  className,
  ...props
}: {
  color?: Color
  className?: string
} & Omit<SwitchPrimitive.Root.Props, 'className' | 'children'>) {
  return (
    <SwitchPrimitive.Root
      data-slot="control"
      {...props}
      className={clsx(
        className,
        // Base styles
        'group relative isolate inline-flex h-6 w-10 cursor-default rounded-full p-[3px] sm:h-5 sm:w-8',
        // Transitions
        'transition duration-200 ease-in-out',
        // Outline and background color in forced-colors mode so switch is still visible
        'forced-colors:outline forced-colors:[--switch-bg:Highlight] dark:forced-colors:[--switch-bg:Highlight]',
        // Unchecked
        'bg-text ring-1 ring-black/5 ring-inset dark:bg-white/5 dark:ring-white/15',
        // Checked
        'data-checked:bg-(--switch-bg) data-checked:ring-(--switch-bg-ring) dark:data-checked:bg-(--switch-bg) dark:data-checked:ring-(--switch-bg-ring)',
        // Focus
        'focus:not-focus-visible:outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-fill',
        // Hover
        'hover:ring-black/15 hover:data-checked:ring-(--switch-bg-ring)',
        'dark:hover:ring-white/25 dark:hover:data-checked:ring-(--switch-bg-ring)',
        // Disabled
        'data-disabled:bg-text data-disabled:opacity-50 data-disabled:data-checked:bg-text data-disabled:data-checked:ring-black/5',
        'dark:data-disabled:bg-white/15 dark:data-disabled:data-checked:bg-white/15 dark:data-disabled:data-checked:ring-white/15',
        // Color specific styles
        colors[color]
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          // Basic layout
          'pointer-events-none relative inline-block size-4.5 rounded-full sm:size-3.5',
          // Transition
          'translate-x-0 transition duration-200 ease-in-out',
          // Invisible border so the switch is still visible in forced-colors mode
          'border border-transparent',
          // Unchecked
          'bg-white shadow-sm ring-1 ring-black/5',
          // Checked
          'group-data-checked:bg-(--switch) group-data-checked:shadow-(--switch-shadow) group-data-checked:ring-(--switch-ring)',
          'group-data-checked:translate-x-4 sm:group-data-checked:translate-x-3',
          // Disabled
          'group-data-checked:group-data-disabled:bg-white group-data-checked:group-data-disabled:shadow-sm group-data-checked:group-data-disabled:ring-black/5'
        )}
      />
    </SwitchPrimitive.Root>
  )
}
