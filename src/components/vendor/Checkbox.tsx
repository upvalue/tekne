import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import clsx from 'clsx'
import type React from 'react'

export function CheckboxGroup({
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
        'space-y-3',
        // With descriptions
        'has-data-[slot=description]:space-y-6 has-data-[slot=description]:**:data-[slot=label]:font-medium'
      )}
    />
  )
}

export function CheckboxField({
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
        'grid grid-cols-[1.125rem_1fr] gap-x-4 gap-y-1 sm:grid-cols-[1rem_1fr]',
        // Control layout
        '*:data-[slot=control]:col-start-1 *:data-[slot=control]:row-start-1 *:data-[slot=control]:mt-0.75 sm:*:data-[slot=control]:mt-1',
        // Label layout
        '*:data-[slot=label]:col-start-2 *:data-[slot=label]:row-start-1',
        // Description layout
        '*:data-[slot=description]:col-start-2 *:data-[slot=description]:row-start-2',
        // With description
        'has-data-[slot=description]:**:data-[slot=label]:font-medium'
      )}
    />
  )
}

export function Checkbox({
  color = 'neutral',
  className,
  ...props
}: {
  color?: string
  className?: string
} & Omit<CheckboxPrimitive.Root.Props, 'className'>) {
  return (
    <CheckboxPrimitive.Root
      data-color={color}
      data-slot="control"
      {...props}
      className={clsx(className, 'group inline-flex focus:outline-hidden')}
    >
      <span
        className={clsx(
          'relative isolate flex size-4.5 sm:size-4 items-center justify-center rounded-[0.3125rem] border border-white/15 bg-white/5 text-text',
          'group-hover:border-white/30 group-data-checked:bg-mark group-data-indeterminate:bg-mark group-data-checked:border-white/5 group-data-indeterminate:border-white/5',
          'after:absolute after:-inset-px after:rounded-[0.3125rem] after:hidden after:shadow-[inset_0_1px_#ffffff26] group-data-checked:after:block group-data-indeterminate:after:block',
          'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent group-data-disabled:opacity-50',
          'forced-colors:group-data-checked:bg-[Highlight] forced-colors:text-[HighlightText]'
        )}
      >
        <svg
          className="size-4 stroke-current opacity-0 group-data-checked:opacity-100 group-data-indeterminate:opacity-100 sm:h-3.5 sm:w-3.5"
          viewBox="0 0 14 14"
          fill="none"
        >
          {/* Checkmark icon */}
          <path
            className="opacity-100 group-data-indeterminate:opacity-0"
            d="M3 8L6 11L11 3.5"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Indeterminate icon */}
          <path
            className="opacity-0 group-data-indeterminate:opacity-100"
            d="M4 4L10 10M10 4L4 10"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </CheckboxPrimitive.Root>
  )
}
