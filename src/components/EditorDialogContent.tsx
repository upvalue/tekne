import { DialogContent } from '@/components/vendor/Dialog'
import { cn } from '@/lib/utils'

/**
 * Overrides some twind classnames of the DialogContent for centering in the editor
 */
export const EditorDialogContent = ({
  children,
  className,
  showCloseButton = true,
}: {
  children: React.ReactNode
  className?: string
  showCloseButton?: boolean
}) => (
  <DialogContent
    showCloseButton={showCloseButton}
    className={cn(
      'max-lg:left-1/2 lg:left-[calc((100vw-min(22vw,300px))/2)] top-[40%]',
      className
    )}
  >
    {children}
  </DialogContent>
)
