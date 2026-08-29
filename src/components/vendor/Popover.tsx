// Thin wrappers over Base UI's popover so app code has one seam for
// popovers; direct @base-ui/react imports are lint-banned outside
// components/vendor. Keeps the Headless UI-era names (PopoverButton,
// PopoverPanel); the panel handles portal + positioning itself.
import * as React from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { cn } from '@/lib/utils'

export function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root {...props} />
}

export function PopoverButton({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-button" {...props} />
}

export function PopoverPanel({
  className,
  side = 'bottom',
  align = 'start',
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Popup> &
  Pick<
    React.ComponentProps<typeof PopoverPrimitive.Positioner>,
    'side' | 'align' | 'sideOffset'
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="z-10"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-panel"
          className={cn('w-(--anchor-width)', className)}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}
