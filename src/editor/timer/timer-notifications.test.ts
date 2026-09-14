import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const platform = vi.hoisted(() => ({ isMobile: true }))
vi.mock('@/lib/platform', () => platform)

const notification = { close: vi.fn() }
const registration = {
  active: {},
  showNotification: vi.fn().mockResolvedValue(undefined),
  getNotifications: vi.fn().mockResolvedValue([notification]),
}
const register = vi.fn().mockResolvedValue(registration)
const requestPermission = vi.fn().mockResolvedValue('granted')
let notifications: typeof import('./timer-notifications')

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  register.mockResolvedValue(registration)
  requestPermission.mockResolvedValue('granted')
  registration.showNotification.mockResolvedValue(undefined)
  registration.getNotifications.mockResolvedValue([notification])
  platform.isMobile = true
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register },
  })
  notifications = await import('./timer-notifications')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

test('desktop does not register a worker or show the mobile notification', async () => {
  platform.isMobile = false
  await notifications.showTimerStartedNotification('Task', Date.now())
  await notifications.enableTimerNotifications()
  expect(register).not.toHaveBeenCalled()
  expect(requestPermission).not.toHaveBeenCalled()
})

test('starting without permission does not prompt or register', async () => {
  vi.stubGlobal('Notification', { permission: 'default', requestPermission })
  await notifications.showTimerStartedNotification('Task', Date.now())
  expect(register).not.toHaveBeenCalled()
  expect(requestPermission).not.toHaveBeenCalled()
})

test('enabling requests permission before waiting for worker setup', async () => {
  const enabled = notifications.enableTimerNotifications()
  expect(requestPermission).toHaveBeenCalledOnce()
  expect(register).not.toHaveBeenCalled()
  expect(await enabled).toBe('granted')
  expect(register).toHaveBeenCalledOnce()
})

test('denied permission leaves the worker unregistered', async () => {
  requestPermission.mockResolvedValueOnce('denied')
  expect(await notifications.enableTimerNotifications()).toBe('denied')
  expect(register).not.toHaveBeenCalled()
})

test('mobile start shows one quiet notification that links to this document', async () => {
  await notifications.showTimerStartedNotification('Write notes', Date.now())
  expect(registration.showNotification).toHaveBeenCalledExactlyOnceWith(
    'Timer started',
    expect.objectContaining({
      body: expect.stringContaining('Write notes'),
      data: { url: window.location.href },
      silent: true,
      tag: 'tekne-active-timer',
    })
  )
  await notifications.dismissTimerNotification()
  expect(notification.close).toHaveBeenCalledOnce()
})

test('stopping during worker setup prevents a stale start notification', async () => {
  let ready!: (value: typeof registration) => void
  register.mockReturnValueOnce(
    new Promise((resolve) => {
      ready = resolve
    })
  )
  const shown = notifications.showTimerStartedNotification('Task', Date.now())
  await Promise.resolve()
  const dismissed = notifications.dismissTimerNotification()
  ready(registration)
  await shown
  await dismissed
  expect(registration.showNotification).not.toHaveBeenCalled()
})

test('notification failure is contained and a later timer can notify', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  registration.showNotification.mockRejectedValueOnce(new Error('OS refused'))
  await expect(
    notifications.showTimerStartedNotification('Task', Date.now())
  ).resolves.toBeUndefined()
  await notifications.showTimerStartedNotification('Another task', Date.now())
  expect(registration.showNotification).toHaveBeenCalledTimes(2)
})
