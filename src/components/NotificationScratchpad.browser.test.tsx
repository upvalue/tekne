import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { page } from '@vitest/browser/context'
import { afterEach, expect, test } from 'vitest'
import { NotificationScratchpad } from './NotificationScratchpad'
import { notifications } from '@/lib/notifications'
import '@/styles/styles.css'

afterEach(() => {
  cleanup()
  notifications.clear()
})

for (const width of [320, 1280]) {
  test(`notifications leave content geometry unchanged at ${width}px`, async () => {
    await page.viewport(width, 800)
    const view = render(
      <>
        <div className="AppContent">
          <main className="Editor">
            <h1>Document title</h1>
            <div className="TEditor-scroll overflow-auto">Existing content</div>
          </main>
        </div>
        <NotificationScratchpad />
      </>
    )
    const content = view.getByRole('main')
    const bar = view.container.querySelector('.NotificationBar')!
    const before = content.getBoundingClientRect().toJSON()
    const barBefore = bar.getBoundingClientRect().toJSON()
    expect(before.bottom).toBeLessThanOrEqual(barBefore.top)
    const message = 'Very long error\n'.repeat(100)
    const description = 'unbrokendetail'.repeat(300)
    act(() => {
      notifications.error(message, {
        description,
        action: { label: 'Retry', onClick: () => {} },
      })
    })
    expect(content.getBoundingClientRect().toJSON()).toEqual(before)
    expect(bar.getBoundingClientRect().toJSON()).toEqual(barBefore)
    expect(bar.scrollWidth).toBeLessThanOrEqual(width)
    expect(bar.scrollHeight).toBeLessThanOrEqual(bar.clientHeight)
    const preview = view.getByRole('status').querySelector('button')!
    expect(getComputedStyle(preview).whiteSpace).toBe('nowrap')
    expect(preview.scrollWidth).toBeGreaterThan(preview.clientWidth)
    fireEvent.click(
      view.getByRole('button', { name: 'Notification history (1)' })
    )
    const dialog = await view.findByRole('dialog', {
      name: 'Notification history',
    })
    expect(dialog.textContent).toContain(message)
    expect(dialog.textContent).toContain(description)
    expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth)
    expect(content.getBoundingClientRect().toJSON()).toEqual(before)
    fireEvent.click(view.getByRole('button', { name: /^Close$/ }))
    act(() => notifications.dismiss())
    expect(content.getBoundingClientRect().toJSON()).toEqual(before)
    expect(bar.getBoundingClientRect().toJSON()).toEqual(barBefore)
    expect(view.getByRole('status', { hidden: true }).textContent).toBe('')
  })
}
