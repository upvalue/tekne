import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { AnimatedMetric } from './AnimatedMetric'
import '@/styles/styles.css'

afterEach(() => {
  cleanup()
})

test('animates changes, cancels interrupted transitions and settles on the latest value', async () => {
  const view = render(<AnimatedMetric value="9" />)
  expect(view.container.getAnimations({ subtree: true })).toHaveLength(0)
  view.rerender(<AnimatedMetric value="10" />)
  expect(view.container.getAnimations({ subtree: true })).toHaveLength(2)
  expect(
    view.container.querySelector('[aria-hidden="true"]')?.textContent
  ).toBe('9')
  view.rerender(<AnimatedMetric value="11" />)
  expect(view.container.getAnimations({ subtree: true })).toHaveLength(2)
  await expect
    .poll(() => view.container.getAnimations({ subtree: true }).length)
    .toBe(0)
  expect(view.getByText('11')).toBeVisible()
  expect(view.container.querySelector('[aria-hidden="true"]')).not.toBeVisible()
})
