// Typed cross-tree window events.
//
// These exist for coordination between React trees that do not share a Jotai
// store — e.g. the side panel asking the editor route to flush a pending
// save. State shared within one tree belongs in atoms instead; reach for a
// window event only when the sender cannot know whether a receiver is
// mounted.
declare global {
  interface WindowEventMap {
    /** Ask the active editor route (if any) to save pending changes now. */
    'tekne:request-save': CustomEvent<{ onComplete?: () => void }>
    /** Open the "new document from template" dialog. */
    'tekne:new-from-template': CustomEvent<undefined>
  }
}

export {}
