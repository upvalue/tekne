import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/vendor/Dialog'
import { EditorDialogContent } from '@/components/EditorDialogContent'
import { Button } from '@/components/vendor/Button'

/**
 * Shown when a save lost a revision race: the server holds a version of the
 * document this client never loaded (another tab, usually). Autosave is
 * paused until the user picks a side, so the dialog cannot be dismissed.
 */
export const SaveConflictDialog = ({
  open,
  onResolve,
}: {
  open: boolean
  onResolve: (choice: 'keepMine' | 'takeServer') => void
}) => (
  <Dialog open={open} onOpenChange={() => {}}>
    <EditorDialogContent>
      <DialogHeader>
        <DialogTitle>Document was changed elsewhere</DialogTitle>
        <DialogDescription>
          A newer version of this document was saved (for example from another
          tab) while you had unsaved edits here. Choose which version to keep —
          the other one is overwritten. Keeping the other version still lets you
          undo back to your edits.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button plain onClick={() => onResolve('takeServer')}>
          Take the other version
        </Button>
        <Button onClick={() => onResolve('keepMine')}>Keep my edits</Button>
      </DialogFooter>
    </EditorDialogContent>
  </Dialog>
)
