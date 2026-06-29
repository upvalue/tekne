import type { ZDoc, ZLine } from './schema'

const nextUnusedTimestamp = (timeCreated: string, used: Set<string>) => {
  let timestampMs = new Date(timeCreated).getTime()
  if (!Number.isFinite(timestampMs)) {
    timestampMs = Date.now()
  }

  let nextTimeCreated = new Date(timestampMs).toISOString()
  while (used.has(nextTimeCreated)) {
    timestampMs += 1
    nextTimeCreated = new Date(timestampMs).toISOString()
  }

  return nextTimeCreated
}

export const ensureUniqueLineTimeCreatedsInPlace = <
  T extends Pick<ZLine, 'timeCreated'>,
>(
  lines: T[]
) => {
  const used = new Set<string>()
  let changed = false

  for (const line of lines) {
    if (!used.has(line.timeCreated)) {
      used.add(line.timeCreated)
      continue
    }

    line.timeCreated = nextUnusedTimestamp(line.timeCreated, used)
    used.add(line.timeCreated)
    changed = true
  }

  return changed
}

export const ensureUniqueLineTimeCreateds = (doc: ZDoc): ZDoc => {
  const children = doc.children.map((line) => ({ ...line }))
  const changed = ensureUniqueLineTimeCreatedsInPlace(children)
  if (!changed) return doc
  return { ...doc, children }
}
