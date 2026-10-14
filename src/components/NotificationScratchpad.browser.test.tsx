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

const timer = (
  <button className="shrink-0 rounded px-2 py-0.5 tabular-nums">● 12:34</button>
)

for (const embedded of [false, true])
  for (const width of [320, 1280]) {
    test(`${embedded ? 'embedded' : 'fixed'} notifications leave content geometry unchanged at ${width}px`, async () => {
      await page.viewport(width, 800)
      const view = render(
        embedded ? (
          <div className="AppContent" data-embedded-bar>
            <div className="Editor">
              <main className="contents">
                <h1>Document title</h1>
                <div className="TEditor-scroll overflow-auto">
                  Existing content
                </div>
              </main>
              <NotificationScratchpad embedded timer={timer} />
            </div>
          </div>
        ) : (
          <>
            <div className="AppContent">
              <main>
                <h1>Document title</h1>
                <div className="TEditor-scroll overflow-auto">
                  Existing content
                </div>
              </main>
            </div>
            <NotificationScratchpad />
          </>
        )
      )
      const content = embedded
        ? view.container.querySelector('.TEditor-scroll')!
        : view.getByRole('main')
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
      if (embedded)
        expect(
          view.getByText('● 12:34').getBoundingClientRect().right
        ).toBeLessThanOrEqual(width)
      const preview = view.getByRole('status').querySelector('button')!
      expect(getComputedStyle(preview).whiteSpace).toBe('nowrap')
      expect(preview.scrollWidth).toBeGreaterThan(preview.clientWidth)
      fireEvent.click(view.getByRole('button', { name: 'Messages (1)' }))
      const dialog = await view.findByRole('dialog', {
        name: 'Messages',
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
