export type NotificationKind = 'error' | 'warning' | 'success' | 'info'
export type NotificationEntry = {
  id: number
  at: string
  kind: NotificationKind
  message: string
  description?: string
  action?: { label: string; onClick: () => unknown }
  actionState?: 'available' | 'running' | 'done' | 'expired'
}

type Options = Pick<NotificationEntry, 'description' | 'action'>
type Snapshot = { entries: NotificationEntry[]; currentId: number | null }

export function createNotificationStore() {
  let snapshot: Snapshot = { entries: [], currentId: null }
  let sequence = 0
  let timeout: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const update = (next: Snapshot) => {
    snapshot = next
    listeners.forEach((listener) => listener())
  }
  const dismiss = () => {
    clearTimeout(timeout)
    update({ ...snapshot, currentId: null })
  }
  const report = (
    kind: NotificationKind,
    message: string,
    options: Options = {}
  ) => {
    const entry: NotificationEntry = {
      id: ++sequence,
      at: new Date().toISOString(),
      kind,
      message,
      ...options,
      actionState: options.action ? 'available' : undefined,
    }
    clearTimeout(timeout)
    update({
      entries: [entry, ...snapshot.entries].slice(0, 50),
      currentId: entry.id,
    })
    timeout = setTimeout(dismiss, 5000)
    return entry.id
  }
  const setActionState = (
    id: number,
    actionState: NotificationEntry['actionState']
  ) => {
    update({
      ...snapshot,
      entries: snapshot.entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              actionState,
              action:
                actionState === 'done' || actionState === 'expired'
                  ? undefined
                  : entry.action,
            }
          : entry
      ),
    })
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    error: (message: string, options?: Options) =>
      report('error', message, options),
    warning: (message: string, options?: Options) =>
      report('warning', message, options),
    success: (message: string, options?: Options) =>
      report('success', message, options),
    info: (message: string, options?: Options) =>
      report('info', message, options),
    dismiss,
    clear: () => {
      clearTimeout(timeout)
      update({ entries: [], currentId: null })
    },
    expireActions: () => {
      update({
        ...snapshot,
        entries: snapshot.entries.map((entry) =>
          entry.actionState === 'available'
            ? { ...entry, action: undefined, actionState: 'expired' }
            : entry
        ),
      })
    },
    runAction: async (id: number) => {
      const entry = snapshot.entries.find((item) => item.id === id)
      if (!entry?.action || entry.actionState !== 'available') return
      setActionState(id, 'running')
      try {
        await entry.action.onClick()
        setActionState(id, 'done')
      } catch (error) {
        setActionState(id, 'done')
        report('error', `${entry.action.label} failed`, {
          description: String(error),
        })
      }
    },
  }
}

export const notifications = createNotificationStore()
