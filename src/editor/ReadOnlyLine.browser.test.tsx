import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { ReadOnlyLine } from './ReadOnlyLine'
import '@/styles/styles.css'

afterEach(cleanup)

test('timer chip aligns with the first text line, including wrapped results', () => {
  const view = render(
    <div style={{ width: 280 }}>
      <ReadOnlyLine
        content={'A long search result '.repeat(12)}
        indent={0}
        datumTimeSeconds={120}
      />
    </div>
  )
  const badge = view.getByLabelText('Recorded time: 2m')
  const text = view.container.querySelector('.cm-line')!
  const badgeRect = badge.getBoundingClientRect()
  const textRect = text.getBoundingClientRect()
  expect(
    Math.abs(badgeRect.top + badgeRect.height / 2 - (textRect.top + 12))
  ).toBeLessThan(1)
  expect(getComputedStyle(badge).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(textRect.height).toBeGreaterThan(24)
})

test('a zero-time result has an icon chip; a result without timer data does not', () => {
  const view = render(
    <ReadOnlyLine content="Task" indent={0} datumTimeSeconds={0} />
  )
  const badge = view.getByLabelText('No time recorded')
  expect(badge.textContent).toBe('')
  expect(badge.querySelector('svg')).not.toBeNull()
  view.rerender(<ReadOnlyLine content="Task" indent={0} />)
  expect(view.queryByLabelText('No time recorded')).toBeNull()
})
