import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { ErrorScratchpadPreview } from './ErrorScratchpadPreview'
import { NotificationScratchpad } from '@/components/NotificationScratchpad'
import { notifications } from '@/lib/notifications'

afterEach(() => {
  cleanup()
  notifications.clear()
})

test('sample errors use the app status line and history', async () => {
  render(
    <>
      <ErrorScratchpadPreview />
      <NotificationScratchpad />
    </>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Simulate save error' }))
  expect(screen.getByRole('status').textContent).toContain(
    'Sample: could not save changes.'
  )
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
  expect(screen.getByRole('status').textContent).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'Messages (1)' }))
  expect(await screen.findByRole('dialog', { name: 'Messages' })).not.toBeNull()
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Clear history' }))
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})
