import { DialogContent } from "@/components/vendor/Dialog"

/**
 * Overrides some twind classnames of the DialogContent for centering in the editor
 */
export const EditorDialogContent = ({ children }: { children: React.ReactNode }) => (
    <DialogContent className="left-[32%] top-[40%] ">
        {children}
    </DialogContent>
)