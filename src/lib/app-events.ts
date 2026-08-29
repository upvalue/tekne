// Typed cross-tree window events.
//
// These exist for coordination between React trees that do not share a Jotai
// store — e.g. the side panel asking the editor route to flush a pending
// save. State shared within one tree belongs in atoms instead; reach for a
// window event only when the sender cannot know whether a receiver is
// mounted.
declare global {
  interface WindowEventMap {
    /**
     * Ask the active editor route (if any) to save pending changes now. The
     * listener synchronously attaches its flush promise to the detail.
     */
    'tekne:request-save': CustomEvent<{ flush?: Promise<void> }>
    /** Open the "new document from template" dialog. */
    'tekne:new-from-template': CustomEvent<undefined>
  }
}

/**
 * Flush the active editor route's unsaved changes. Dispatch is synchronous:
 * a mounted editor attaches its flush promise to the event detail, and no
 * promise afterwards means no editor is mounted and nothing needs saving.
 * Rejects when the flush fails, so callers can abort work that depends on
 * the save (e.g. a server-side tag rewrite).
 */
export const requestEditorFlush = (): Promise<void> => {
  const detail: { flush?: Promise<void> } = {}
  window.dispatchEvent(new CustomEvent('tekne:request-save', { detail }))
  return detail.flush ?? Promise.resolve()
}
