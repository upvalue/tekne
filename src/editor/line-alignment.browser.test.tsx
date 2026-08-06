// Layout regression test for line decoration alignment. The gutter
// timestamp, bullet glyph, checkbox and timer badge must all center on the
// first rendered text line — even when the line wraps — and jsdom can't
// measure any of that, so this runs in a real browser (see the "browser"
// vitest project in vite.config.ts).
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { TEditor } from './TEditor'
import { docAtom } from './state'
import { docMake, lineMake } from '@/docs/schema'
import { ReadOnlyLine } from './ReadOnlyLine'
import '@/styles/styles.css'

/** Alignment tolerance in px; subpixel rounding is fine, a strut is not. */
const TOLERANCE = 1

const centerY = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.top + r.height / 2
}

/** Center of the first rendered text line of a line's CodeMirror block. */
const firstTextLineCenter = (lineEl: Element) => {
  const cm = lineEl.querySelector('.cm-line')
  if (!cm) throw new Error('line has no .cm-line')
  const lineHeight = parseFloat(getComputedStyle(cm).lineHeight)
  return cm.getBoundingClientRect().top + lineHeight / 2
}

/**
 * Assert every leading decoration (and, for ELine, the gutter text) of a
 * line centers on the line's first text line.
 */
const expectLineAligned = (lineEl: Element) => {
  const target = firstTextLineCenter(lineEl)

  const decorations = [
    ...lineEl.querySelectorAll('.ELine-leading > *'),
    ...lineEl.querySelectorAll('.ELine-gutter-text'),
  ]
  expect(decorations.length).toBeGreaterThan(0)

  for (const el of decorations) {
    expect
      .soft(
        Math.abs(centerY(el) - target),
        `${el.className} center ${centerY(el)} vs first text line center ${target}`
      )
      .toBeLessThanOrEqual(TOLERANCE)
  }
}

const mount = (ui: React.ReactElement) => {
  const container = document.createElement('div')
  // Fixed width so the long-content lines wrap the same way everywhere
  container.style.width = '700px'
  document.body.appendChild(container)
  return render(ui, { container })
}

const LONG_CONTENT =
  'a line long enough to wrap onto several visual lines in a 700px ' +
  'container, which must not drag the gutter, bullet or badges down ' +
  'toward the middle of the whole block instead of the first text line'

describe('ELine decoration alignment', () => {
  test('bullet, checkbox, timer badge and gutter center on the first text line', async () => {
    const store = createStore()
    store.set(
      docAtom,
      docMake([
        lineMake(0, 'plain line'),
        lineMake(0, 'all the trimmings', {
          datumTimeSeconds: 90,
          datumTaskStatus: 'incomplete',
        }),
        lineMake(1, LONG_CONTENT, { datumTimeSeconds: 3600 }),
        lineMake(0, 'pinned', { datumPinnedAt: lineMake(0).timeCreated }),
      ])
    )

    const { container } = mount(
      <Provider store={store}>
        <TEditor />
      </Provider>
    )
    // Let CodeMirror finish its post-mount measure pass
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r)))

    const lines = container.querySelectorAll('.ELine')
    expect(lines.length).toBe(4)

    const wrapped = lines[2].querySelector('.cm-line')!
    expect(
      wrapped.getBoundingClientRect().height,
      'long line should actually wrap'
    ).toBeGreaterThan(parseFloat(getComputedStyle(wrapped).lineHeight) * 1.5)

    lines.forEach(expectLineAligned)
  })
})

describe('ReadOnlyLine decoration alignment', () => {
  test('bullet, checkbox and timer badge center on the first text line', async () => {
    const { container } = mount(
      <div>
        <ReadOnlyLine content="plain line" indent={0} />
        <ReadOnlyLine
          content={LONG_CONTENT}
          indent={0}
          datumTaskStatus="complete"
          datumTimeSeconds={90}
        />
      </div>
    )
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r)))

    const lines = container.querySelectorAll('.ReadOnlyLine')
    expect(lines.length).toBe(2)
    lines.forEach(expectLineAligned)
  })
})
