import { type Completion, CompletionContext } from '@codemirror/autocomplete'
import type { useStore } from 'jotai'
import { docAtom } from '../state'
import { formatDate } from '@/lib/utils'
import { renderTime } from '@/lib/time'
import { parseTime } from '../timer/parse-time'
import { startTimer } from '../timer/timer-controller'

const COMMANDS = [
  'stopwatch',
  'countdown',
  'log',
  'task',
  'pin',
  'date',
] as const

export const slashCommandsPlugin =
  (getLineIdx: () => number, store: ReturnType<typeof useStore>) =>
  (context: CompletionContext) => {
    const word = context.matchBefore(/\/[a-z]*(?:[ \t]+[\d.hms \t]*)?/)
    if (!word) return null
    const before = context.state.doc.sliceString(
      context.state.doc.lineAt(word.from).from,
      word.from
    )
    if (before && !/\s$/.test(before)) return null
    const [prefix, ...args] = word.text.slice(1).split(/\s+/)
    const argument = args.join(' ').trim()
    const options: Completion[] = COMMANDS.filter((name) =>
      name.startsWith(prefix)
    ).map((name) => {
      const duration = parseTime(
        argument || (name === 'countdown' ? '25m' : '45m')
      )
      const preview =
        name === 'stopwatch'
          ? 'Start stopwatch · 0:00'
          : name === 'countdown'
            ? duration
              ? `${renderTime(duration)} · start countdown`
              : 'Enter a duration, e.g. 25m'
            : name === 'log'
              ? duration !== null
                ? `Add ${renderTime(duration)} logged`
                : 'Enter a duration, e.g. 45m'
              : name === 'task'
                ? 'Make task'
                : name === 'pin'
                  ? 'Pin this line'
                  : formatDate(new Date())
      return {
        label: `/${name}${argument ? ` ${argument}` : ''}`,
        detail: preview,
        type: 'text',
        apply: (view, _completion, from, to) => {
          if (
            (name === 'countdown' || name === 'log') &&
            (duration === null || duration <= 0)
          )
            return
          view.dispatch({
            changes: {
              from,
              to,
              insert: name === 'date' ? formatDate(new Date()) : '',
            },
          })
          const lineIdx = getLineIdx()
          if (name === 'stopwatch' || name === 'countdown') {
            const line = store.get(docAtom).children[lineIdx]
            if (line)
              void startTimer(store, {
                line,
                mode: name,
                timeMode: 'additive',
                targetDuration: duration || 1500,
              })
          } else if (name !== 'date') {
            store.set(docAtom, (draft) => {
              const line = draft.children[lineIdx]
              if (!line) return
              if (name === 'task') line.datumTaskStatus = 'unset'
              if (name === 'pin') line.datumPinnedAt = new Date().toISOString()
              if (name === 'log')
                line.datumTimeSeconds = (line.datumTimeSeconds ?? 0) + duration!
            })
          }
        },
      }
    })
    return { from: word.from, options, filter: false }
  }
