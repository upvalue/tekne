import { useId, type ReactElement } from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'

export function Tooltip({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactElement
}) {
  const descriptionId = useId()
  return (
    <TooltipPrimitive.Provider delay={350}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger
          render={children}
          aria-describedby={descriptionId}
        />
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner
            side="bottom"
            sideOffset={8}
            className="z-50"
          >
            <TooltipPrimitive.Popup
              id={descriptionId}
              role="tooltip"
              className="max-w-56 rounded-md border border-white/10 bg-raised px-3 py-2 text-xs text-text shadow-lg"
            >
              <div className="font-medium">{label}</div>
              {description && (
                <div className="mt-1 text-muted leading-4">{description}</div>
              )}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
