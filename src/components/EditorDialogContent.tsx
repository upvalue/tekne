import { DialogContent } from "@/components/vendor/Dialog"
import { cn } from "@/lib/utils"

/**
 * Overrides some twind classnames of the DialogContent for centering in the editor
 */
export const EditorDialogContent = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <DialogContent className={cn("left-[32%] top-[40%] ", className)}>
        {children}
    </DialogContent>
)