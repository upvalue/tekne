import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ErrorScratchpadPreview } from './ErrorScratchpadPreview'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test('expires the latest status independently and retains errors in history', () => {
  vi.useFakeTimers()
  render(<ErrorScratchpadPreview />)
  fireEvent.click(screen.getByRole('button', { name: 'Simulate save error' }))
  act(() => vi.advanceTimersByTime(4000))
  fireEvent.click(screen.getByRole('button', { name: 'Simulate search error' }))
  act(() => vi.advanceTimersByTime(1000))
  expect(screen.getByRole('status').textContent).toContain('Search unavailable')
  act(() => vi.advanceTimersByTime(4000))
  expect(screen.getByRole('status').textContent).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'History (2)' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Clear history' }))
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})

test('dismissing the status preserves its history entry', () => {
  render(<ErrorScratchpadPreview />)
  fireEvent.click(screen.getByRole('button', { name: 'Simulate save error' }))
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(screen.getByRole('status').textContent).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'History (1)' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
})
